const pool = require('../config/database');

async function getRequestAccess(requestId, userId, role) {
  const result = await pool.query(`
    SELECT mr.id, t.user_id AS tenant_user_id, ma.fundi_id
    FROM maintenance_requests mr
    JOIN tenants t ON t.id = mr.tenant_id
    LEFT JOIN maintenance_assignments ma ON ma.maintenance_request_id = mr.id
    WHERE mr.id = $1
  `, [requestId]);
  const row = result.rows[0];
  if (!row) return false;
  return role === 'admin' || (role === 'tenant' && row.tenant_user_id === userId) || (role === 'fundi' && row.fundi_id === userId);
}

const MAX_PHOTOS_PER_REQUEST = 5;

async function insertPhotos(items) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Lock the request row so two simultaneous uploads cannot both pass the limit.
    await client.query('SELECT id FROM maintenance_requests WHERE id = $1 FOR UPDATE', [items[0].requestId]);
    const existing = await client.query(
      'SELECT COUNT(*)::int AS total FROM maintenance_request_photos WHERE maintenance_request_id = $1',
      [items[0].requestId]
    );
    if (existing.rows[0].total + items.length > MAX_PHOTOS_PER_REQUEST) {
      throw Object.assign(
        new Error(`A maintenance request can have at most ${MAX_PHOTOS_PER_REQUEST} photos.`),
        { statusCode: 409 }
      );
    }
    const saved = [];
    for (const data of items) {
      const result = await client.query(`
        INSERT INTO maintenance_request_photos
          (maintenance_request_id, uploaded_by, storage_name, original_name, mime_type, size_bytes)
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING id, maintenance_request_id, original_name, mime_type, size_bytes, created_at
      `, [data.requestId, data.userId, data.storageName, data.originalName, data.mimeType, data.sizeBytes]);
      saved.push(result.rows[0]);
    }
    await client.query('COMMIT');
    return saved;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

async function listPhotos(requestId) {
  const result = await pool.query(`
    SELECT id, maintenance_request_id, original_name, mime_type, size_bytes, created_at
    FROM maintenance_request_photos WHERE maintenance_request_id = $1 ORDER BY created_at
  `, [requestId]);
  return result.rows;
}

async function getPhoto(id) {
  const result = await pool.query('SELECT * FROM maintenance_request_photos WHERE id = $1', [id]);
  return result.rows[0] || null;
}

// includeContact is true only for the fundi themself and for admins.
async function getFundiProfile(userId, { includeContact = false } = {}) {
  const result = await pool.query(`
    SELECT u.id AS user_id, u.name,
      CASE WHEN $2::boolean THEN u.email END AS email,
      CASE WHEN $2::boolean THEN u.phone END AS phone,
      COALESCE(fp.bio, '') AS bio,
      COALESCE(fp.skills, '{}') AS skills,
      COALESCE(fp.specialisations, '{}') AS specialisations,
      COALESCE(fp.verification_status, 'unverified') AS verification_status,
      COALESCE(stats.completed_jobs, 0)::int AS completed_jobs,
      ROUND(stats.average_rating::numeric, 2) AS average_rating,
      COALESCE(stats.rating_count, 0)::int AS rating_count
    FROM users u
    LEFT JOIN fundi_profiles fp ON fp.user_id = u.id
    LEFT JOIN LATERAL (
      SELECT COUNT(DISTINCT ma.maintenance_request_id) FILTER (WHERE ma.completed_at IS NOT NULL) AS completed_jobs,
        AVG(rating.score) AS average_rating, COUNT(rating.id) AS rating_count
      FROM maintenance_assignments ma
      LEFT JOIN maintenance_ratings rating ON rating.maintenance_request_id = ma.maintenance_request_id
      WHERE ma.fundi_id = u.id
    ) stats ON TRUE
    WHERE u.id = $1 AND u.role = 'fundi'
  `, [userId, includeContact]);
  return result.rows[0] || null;
}

// A tenant may only view fundis who have been assigned to one of their own requests.
async function tenantCanViewFundi(tenantUserId, fundiId) {
  const result = await pool.query(`
    SELECT 1
    FROM maintenance_assignments ma
    JOIN maintenance_requests mr ON mr.id = ma.maintenance_request_id
    JOIN tenants t ON t.id = mr.tenant_id
    WHERE t.user_id = $1 AND ma.fundi_id = $2
    LIMIT 1
  `, [tenantUserId, fundiId]);
  return result.rowCount > 0;
}

async function saveFundiProfile(userId, { bio, skills, specialisations }) {
  const result = await pool.query(`
    INSERT INTO fundi_profiles (user_id, bio, skills, specialisations)
    VALUES ($1,$2,$3,$4)
    ON CONFLICT (user_id) DO UPDATE SET bio = EXCLUDED.bio,
      skills = EXCLUDED.skills, specialisations = EXCLUDED.specialisations,
      updated_at = NOW()
    RETURNING user_id, bio, skills, specialisations, verification_status, updated_at
  `, [userId, bio, skills, specialisations]);
  return result.rows[0];
}

async function updateVerification(userId, status) {
  const result = await pool.query(`
    INSERT INTO fundi_profiles(user_id, verification_status)
    SELECT u.id, $2 FROM users u WHERE u.id = $1 AND u.role = 'fundi'
    ON CONFLICT(user_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, updated_at = NOW()
    RETURNING user_id, verification_status
  `, [userId, status]);
  return result.rows[0] || null;
}

async function getAnalytics() {
  const [summary, categories, monthly, fundis, properties] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS total_requests,
      COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_requests,
      COUNT(*) FILTER (WHERE status NOT IN ('completed','cancelled'))::int AS open_requests,
      COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled_requests,
      COALESCE((SELECT SUM(repair_cost_cents) FROM maintenance_responsibilities),0)::bigint AS recorded_repair_cost_cents,
      (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (ma.completed_at - mr2.created_at)) / 3600)::numeric, 1)
         FROM maintenance_assignments ma
         JOIN maintenance_requests mr2 ON mr2.id = ma.maintenance_request_id
         WHERE ma.completed_at IS NOT NULL) AS avg_completion_hours
      FROM maintenance_requests`),
    pool.query(`SELECT category, COUNT(*)::int AS request_count FROM maintenance_requests GROUP BY category ORDER BY request_count DESC`),
    pool.query(`SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month, COUNT(*)::int AS request_count
      FROM maintenance_requests WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY 1 ORDER BY 1`),
    pool.query(`SELECT u.id, u.name, COALESCE(fp.verification_status, 'unverified') AS verification_status, COUNT(DISTINCT ma.maintenance_request_id) FILTER (WHERE ma.completed_at IS NOT NULL)::int AS completed_jobs,
      ROUND(AVG(r.score)::numeric,2) AS average_rating, COUNT(r.id)::int AS rating_count
      FROM users u LEFT JOIN fundi_profiles fp ON fp.user_id = u.id LEFT JOIN maintenance_assignments ma ON ma.fundi_id = u.id
      LEFT JOIN maintenance_ratings r ON r.maintenance_request_id = ma.maintenance_request_id
      WHERE u.role = 'fundi' GROUP BY u.id,u.name,fp.verification_status ORDER BY completed_jobs DESC`),
    pool.query(`SELECT p.id, p.name, COUNT(mr.id)::int AS request_count,
      COUNT(mr.id) FILTER (WHERE mr.status = 'completed')::int AS completed_count,
      COALESCE(SUM(cost.repair_cost_cents),0)::bigint AS repair_cost_cents
      FROM properties p
      LEFT JOIN rooms rm ON rm.property_id = p.id
      LEFT JOIN maintenance_requests mr ON mr.room_id = rm.id
      LEFT JOIN (SELECT maintenance_request_id, SUM(repair_cost_cents) AS repair_cost_cents
                 FROM maintenance_responsibilities GROUP BY maintenance_request_id) cost
        ON cost.maintenance_request_id = mr.id
      GROUP BY p.id, p.name ORDER BY request_count DESC`)
  ]);
  return { summary: summary.rows[0], categories: categories.rows, monthly: monthly.rows, fundis: fundis.rows, properties: properties.rows };
}

// Read-only lists behind the clickable analytics tiles (completion times and ratings).
async function getAnalyticsDetails() {
  const [completions, ratings] = await Promise.all([
    pool.query(`SELECT mr.id AS request_id, mr.category, mr.description, ma.completed_at,
        ROUND((EXTRACT(EPOCH FROM (ma.completed_at - mr.created_at)) / 3600)::numeric, 1) AS hours,
        u.name AS fundi_name
      FROM maintenance_assignments ma
      JOIN maintenance_requests mr ON mr.id = ma.maintenance_request_id
      LEFT JOIN users u ON u.id = ma.fundi_id
      WHERE ma.completed_at IS NOT NULL
      ORDER BY ma.completed_at DESC LIMIT 200`),
    pool.query(`SELECT r.id, r.score, r.comment, r.created_at, mr.category, mr.description,
        (SELECT u.name FROM maintenance_assignments ma JOIN users u ON u.id = ma.fundi_id
          WHERE ma.maintenance_request_id = mr.id ORDER BY ma.completed_at DESC NULLS LAST LIMIT 1) AS fundi_name
      FROM maintenance_ratings r
      JOIN maintenance_requests mr ON mr.id = r.maintenance_request_id
      ORDER BY r.created_at DESC LIMIT 200`),
  ]);
  return { completions: completions.rows, ratings: ratings.rows };
}

module.exports = { getRequestAccess, insertPhotos, listPhotos, getPhoto, getFundiProfile, tenantCanViewFundi, saveFundiProfile, updateVerification, getAnalytics, getAnalyticsDetails };
const propertyRepository = require("../repositories/propertyRepository");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ROOMS_AT_ONCE = 100;

async function listProperties(req, res) {
  try {
    const properties = await propertyRepository.listPropertiesWithRooms();
    return res.status(200).json({ properties });
  } catch (error) {
    console.error("List properties error:", error);
    return res.status(500).json({ message: "Unable to load properties." });
  }
}

async function createProperty(req, res) {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const address = typeof req.body?.address === "string" ? req.body.address.trim() : "";

  if (name.length < 2 || name.length > 150) {
    return res.status(400).json({ message: "Property name must be 2 to 150 characters." });
  }

  if (address.length < 3 || address.length > 500) {
    return res.status(400).json({ message: "Enter the property's address (3 to 500 characters)." });
  }

  try {
    const property = await propertyRepository.createProperty({ name, address });
    return res.status(201).json({ message: "Property added.", property });
  } catch (error) {
    console.error("Create property error:", error);
    return res.status(500).json({ message: "Unable to add the property." });
  }
}

// Accepts a list of room numbers, e.g. ["A1", "A2", "B1"].
async function createRooms(req, res) {
  const { propertyId } = req.params;

  if (!UUID.test(propertyId)) {
    return res.status(400).json({ message: "Invalid property ID." });
  }

  const raw = Array.isArray(req.body?.roomNumbers) ? req.body.roomNumbers : [];
  const roomNumbers = [
    ...new Set(
      raw
        .filter((value) => typeof value === "string" || typeof value === "number")
        .map((value) => String(value).trim())
        .filter(Boolean)
    ),
  ];

  if (roomNumbers.length === 0) {
    return res.status(400).json({ message: "Enter at least one room number." });
  }

  if (roomNumbers.length > MAX_ROOMS_AT_ONCE) {
    return res.status(400).json({ message: `Add at most ${MAX_ROOMS_AT_ONCE} rooms at a time.` });
  }

  if (roomNumbers.some((value) => value.length > 50)) {
    return res.status(400).json({ message: "A room number can be at most 50 characters." });
  }

  try {
    const result = await propertyRepository.createRooms(propertyId, roomNumbers);

    if (!result) {
      return res.status(404).json({ message: "Property not found." });
    }

    return res.status(201).json({
      message:
        result.created.length > 0
          ? `${result.created.length} room(s) added.`
          : "Those rooms already exist.",
      created: result.created,
      skipped: result.skipped,
    });
  } catch (error) {
    console.error("Create rooms error:", error);
    return res.status(500).json({ message: "Unable to add the rooms." });
  }
}

module.exports = { listProperties, createProperty, createRooms };
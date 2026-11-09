DO $migration$
BEGIN
  IF EXISTS (
    SELECT maintenance_request_id
    FROM public.payments
    WHERE status IN ('pending', 'processing', 'paid')
    GROUP BY maintenance_request_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot add payment protection: duplicate pending, processing, or paid payments already exist. Review these records first.';
  END IF;
END
$migration$;

CREATE UNIQUE INDEX IF NOT EXISTS
  uq_payments_one_active_or_paid_per_request
ON public.payments (maintenance_request_id)
WHERE status IN ('pending', 'processing', 'paid');
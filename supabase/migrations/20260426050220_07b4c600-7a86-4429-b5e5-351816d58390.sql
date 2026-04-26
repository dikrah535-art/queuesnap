CREATE OR REPLACE FUNCTION public.assign_next_slot()
 RETURNS TABLE(slot_id uuid, slot_label text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _id uuid;
  _label text;
  _next_num int;
  _total int;
BEGIN
  -- Lock to avoid races between concurrent check-ins
  PERFORM pg_advisory_xact_lock(91823471);

  -- Try to reuse the lowest free slot whose label is "Slot N"
  SELECT s.id, s.label
    INTO _id, _label
    FROM public.slots s
   WHERE s.is_occupied = false
     AND s.label ~ '^Slot [0-9]+$'
   ORDER BY (regexp_replace(s.label, '^Slot ', ''))::int ASC
   LIMIT 1;

  IF _id IS NULL THEN
    -- Fall back to ANY free slot (covers labels not matching pattern)
    SELECT s.id, s.label INTO _id, _label
      FROM public.slots s
     WHERE s.is_occupied = false
     ORDER BY s.created_at ASC
     LIMIT 1;
  END IF;

  IF _id IS NULL THEN
    -- Hard cap to prevent abuse via anonymous check-ins
    SELECT COUNT(*) INTO _total FROM public.slots;
    IF _total >= 500 THEN
      RAISE EXCEPTION 'No slots available' USING ERRCODE = 'check_violation';
    END IF;

    -- No free slot — create the next numbered one
    SELECT COALESCE(
             MAX((regexp_replace(s.label, '^Slot ', ''))::int),
             0
           ) + 1
      INTO _next_num
      FROM public.slots s
     WHERE s.label ~ '^Slot [0-9]+$';

    INSERT INTO public.slots (label, is_occupied)
    VALUES ('Slot ' || _next_num, false)
    RETURNING id, label INTO _id, _label;
  END IF;

  RETURN QUERY SELECT _id, _label;
END;
$function$;
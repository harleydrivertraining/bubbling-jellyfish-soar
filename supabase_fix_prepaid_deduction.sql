-- Drop existing trigger and function if they exist to avoid conflicts
DROP TRIGGER IF EXISTS on_lesson_completed_deduct_hours ON bookings;
DROP FUNCTION IF EXISTS handle_prepaid_deduction();

CREATE OR REPLACE FUNCTION handle_prepaid_deduction()
RETURNS TRIGGER AS $$
DECLARE
    lesson_duration_hours FLOAT;
    remaining_to_deduct FLOAT;
    pkg_record RECORD;
    deducted_from_pkg FLOAT;
BEGIN
    -- Only run when status changes to 'completed'
    -- And only for lessons that aren't already marked as paid
    IF (NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') AND NEW.is_paid = FALSE AND NEW.student_id IS NOT NULL AND NEW.lesson_type != 'Personal') THEN
        
        -- Calculate duration in hours
        lesson_duration_hours := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600;
        remaining_to_deduct := lesson_duration_hours;

        -- Find active packages for this student, oldest first (FIFO)
        FOR pkg_record IN 
            SELECT id, remaining_hours 
            FROM pre_paid_hours 
            WHERE student_id = NEW.student_id 
            AND remaining_hours > 0 
            ORDER BY purchase_date ASC, created_at ASC
        LOOP
            IF remaining_to_deduct <= 0 THEN
                EXIT;
            END IF;

            -- Determine how much to take from this package
            deducted_from_pkg := LEAST(pkg_record.remaining_hours, remaining_to_deduct);

            -- Update the package balance
            UPDATE pre_paid_hours 
            SET remaining_hours = remaining_hours - deducted_from_pkg
            WHERE id = pkg_record.id;

            -- Record the transaction
            INSERT INTO pre_paid_hours_transactions (
                user_id,
                student_id,
                pre_paid_hours_id,
                booking_id,
                hours_deducted,
                transaction_date
            ) VALUES (
                NEW.user_id,
                NEW.student_id,
                pkg_record.id,
                NEW.id,
                deducted_from_pkg,
                NOW()
            );

            remaining_to_deduct := remaining_to_deduct - deducted_from_pkg;
        END LOOP;

        -- If we successfully deducted the full amount, mark the lesson as paid
        IF remaining_to_deduct <= 0 THEN
            NEW.is_paid := TRUE;
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create the trigger
CREATE TRIGGER on_lesson_completed_deduct_hours
BEFORE UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION handle_prepaid_deduction();
-- 1. Function to deduct hours when a booking is completed
CREATE OR REPLACE FUNCTION public.handle_booking_completion()
RETURNS TRIGGER AS $$
DECLARE
    booking_duration_hours FLOAT;
    remaining_to_deduct FLOAT;
    package_record RECORD;
    deduction FLOAT;
BEGIN
    -- Only proceed if status changed to 'completed' and it's not already marked as paid
    IF (NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') AND NEW.is_paid = false AND NEW.student_id IS NOT NULL) THEN
        
        -- Calculate duration in hours
        booking_duration_hours := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600;
        remaining_to_deduct := booking_duration_hours;

        -- Find available pre-paid packages for this student, oldest first
        FOR package_record IN 
            SELECT id, remaining_hours 
            FROM public.pre_paid_hours 
            WHERE student_id = NEW.student_id AND remaining_hours > 0
            ORDER BY purchase_date ASC, created_at ASC
        LOOP
            IF remaining_to_deduct <= 0 THEN
                EXIT;
            END IF;

            -- Determine how much to deduct from this package
            deduction := LEAST(package_record.remaining_hours, remaining_to_deduct);

            -- Update the package
            UPDATE public.pre_paid_hours 
            SET remaining_hours = remaining_hours - deduction
            WHERE id = package_record.id;

            -- Record the transaction
            INSERT INTO public.pre_paid_hours_transactions (
                user_id,
                student_id,
                pre_paid_hours_id,
                booking_id,
                hours_deducted,
                transaction_date
            ) VALUES (
                NEW.user_id,
                NEW.student_id,
                package_record.id,
                NEW.id,
                deduction,
                NOW()
            );

            remaining_to_deduct := remaining_to_deduct - deduction;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Function to return hours if a completed booking is deleted or cancelled
CREATE OR REPLACE FUNCTION public.handle_booking_reversal()
RETURNS TRIGGER AS $$
DECLARE
    transaction_record RECORD;
BEGIN
    -- If a completed booking is deleted OR status changed from 'completed' to something else
    IF (TG_OP = 'DELETE' AND OLD.status = 'completed') OR 
       (TG_OP = 'UPDATE' AND OLD.status = 'completed' AND NEW.status != 'completed') THEN
        
        -- Find and reverse all transactions associated with this booking
        FOR transaction_record IN 
            SELECT id, pre_paid_hours_id, hours_deducted 
            FROM public.pre_paid_hours_transactions 
            WHERE booking_id = OLD.id
        LOOP
            -- Return hours to the original package
            UPDATE public.pre_paid_hours 
            SET remaining_hours = remaining_hours + transaction_record.hours_deducted
            WHERE id = transaction_record.pre_paid_hours_id;

            -- Delete the transaction record
            DELETE FROM public.pre_paid_hours_transactions WHERE id = transaction_record.id;
        END LOOP;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the triggers
DROP TRIGGER IF EXISTS tr_handle_booking_completion ON public.bookings;
CREATE TRIGGER tr_handle_booking_completion
    AFTER UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_booking_completion();

DROP TRIGGER IF EXISTS tr_handle_booking_reversal ON public.bookings;
CREATE TRIGGER tr_handle_booking_reversal
    AFTER UPDATE OR DELETE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_booking_reversal();
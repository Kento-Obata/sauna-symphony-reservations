import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ReservationFormData } from "@/types/reservation";
import { format } from "date-fns";

interface ReservationConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (paymentMethod: "cash" | "online") => void;
  reservation: ReservationFormData;
  onEdit: () => void;
}

const TIME_SLOTS = {
  morning: "10:00-12:30",
  afternoon: "13:30-16:00",
  evening: "17:00-19:30",
};

export function ReservationConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  reservation,
  onEdit,
}: ReservationConfirmDialogProps) {
  const handlePaymentMethodSelect = (method: "cash" | "online") => {
    onConfirm(method);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Reservation</AlertDialogTitle>
          <AlertDialogDescription>
            Please review your reservation details and select a payment method.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <h4 className="font-medium">Reservation Details</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">Date:</div>
              <div>{format(new Date(reservation.date), "yyyy/MM/dd")}</div>
              
              <div className="text-muted-foreground">Time:</div>
              <div>{TIME_SLOTS[reservation.time_slot]}</div>
              
              <div className="text-muted-foreground">Name:</div>
              <div>{reservation.guest_name}</div>
              
              <div className="text-muted-foreground">Number of guests:</div>
              <div>{reservation.guest_count}</div>
              
              <div className="text-muted-foreground">Phone:</div>
              <div>{reservation.phone}</div>
              
              {reservation.email && (
                <>
                  <div className="text-muted-foreground">Email:</div>
                  <div>{reservation.email}</div>
                </>
              )}
              
              <div className="text-muted-foreground">Water temperature:</div>
              <div>{reservation.water_temperature}°C</div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium">Payment Method</h4>
            <RadioGroup defaultValue="cash" onValueChange={(value: "cash" | "online") => handlePaymentMethodSelect(value)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="cash" id="cash" />
                <Label htmlFor="cash">Pay at venue (¥40,000)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="online" id="online" />
                <Label htmlFor="online">Pay online now (¥40,000)</Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onEdit}>
            Edit Details
          </Button>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => handlePaymentMethodSelect("cash")}>
            Confirm Reservation
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
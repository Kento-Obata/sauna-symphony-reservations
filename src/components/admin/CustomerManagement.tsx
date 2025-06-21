
import { useState } from "react";
import { CustomerSearch } from "./CustomerSearch";
import { CustomerDetail } from "./CustomerDetail";

export const CustomerManagement = () => {
  const [selectedUserKey, setSelectedUserKey] = useState<string | null>(null);

  const handleCustomerSelect = (userKey: string) => {
    setSelectedUserKey(userKey);
  };

  const handleBack = () => {
    setSelectedUserKey(null);
  };

  return (
    <div className="space-y-6">
      {selectedUserKey ? (
        <CustomerDetail 
          userKey={selectedUserKey} 
          onBack={handleBack}
        />
      ) : (
        <CustomerSearch onCustomerSelect={handleCustomerSelect} />
      )}
    </div>
  );
};

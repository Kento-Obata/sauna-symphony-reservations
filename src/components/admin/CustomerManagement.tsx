
import { useState, useEffect } from "react";
import { CustomerSearch } from "./CustomerSearch";
import { CustomerDetail } from "./CustomerDetail";

interface CustomerManagementProps {
  initialUserKey?: string | null;
  onUserKeyChange?: (userKey: string | null) => void;
}

export const CustomerManagement = ({ 
  initialUserKey, 
  onUserKeyChange 
}: CustomerManagementProps) => {
  const [selectedUserKey, setSelectedUserKey] = useState<string | null>(initialUserKey || null);

  useEffect(() => {
    if (initialUserKey) {
      setSelectedUserKey(initialUserKey);
    }
  }, [initialUserKey]);

  const handleCustomerSelect = (userKey: string) => {
    setSelectedUserKey(userKey);
    onUserKeyChange?.(userKey);
  };

  const handleBack = () => {
    setSelectedUserKey(null);
    onUserKeyChange?.(null);
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

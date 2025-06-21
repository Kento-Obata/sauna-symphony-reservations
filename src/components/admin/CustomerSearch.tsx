
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, User } from "lucide-react";
import { useCustomerSearch } from "@/hooks/useCustomers";
import { CustomerSearchResult } from "@/types/customer";

interface CustomerSearchProps {
  onCustomerSelect: (userKey: string) => void;
}

export const CustomerSearch = ({ onCustomerSelect }: CustomerSearchProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  
  const { data: searchResults, isLoading } = useCustomerSearch(submittedQuery);

  const handleSearch = () => {
    setSubmittedQuery(searchQuery);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // グループ化されたデータを取得
  const groupedResults = searchResults?.reduce((acc, result) => {
    if (!acc[result.user_key]) {
      acc[result.user_key] = {
        user_key: result.user_key,
        phone: result.phone,
        latest_name: result.guest_name,
        latest_email: result.email,
        reservations: []
      };
    }
    acc[result.user_key].reservations.push(result);
    return acc;
  }, {} as Record<string, {
    user_key: string;
    phone: string;
    latest_name: string;
    latest_email: string | null;
    reservations: CustomerSearchResult[];
  }>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          顧客検索
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="電話番号または名前で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <Button onClick={handleSearch} disabled={!searchQuery.trim()}>
            検索
          </Button>
        </div>

        {isLoading && <div>検索中...</div>}

        {submittedQuery && groupedResults && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              "{submittedQuery}" の検索結果: {Object.keys(groupedResults).length}件の顧客
            </p>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>顧客情報</TableHead>
                  <TableHead>予約回数</TableHead>
                  <TableHead>最新予約</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.values(groupedResults).map((customer) => (
                  <TableRow key={customer.user_key}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{customer.latest_name}</div>
                        <div className="text-sm text-gray-500">
                          {customer.phone}
                        </div>
                        {customer.latest_email && (
                          <div className="text-sm text-gray-500">
                            {customer.latest_email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {customer.reservations.length}回
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {customer.reservations[0]?.date}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onCustomerSelect(customer.user_key)}
                      >
                        <User className="h-4 w-4 mr-1" />
                        詳細
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

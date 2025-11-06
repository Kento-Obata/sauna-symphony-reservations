
import { useState, useEffect } from "react";
import { useOptions } from "@/hooks/useOptions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircle, Trash, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { Option } from "@/types/option";
import { formatPrice } from "@/utils/priceCalculations";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

interface OptionFormValues {
  name: string;
  description: string;
  pricing_type: 'per_person' | 'flat' | 'per_guest';
  price_per_person: number;
  flat_price: number | null;
  is_active: boolean;
}

export const OptionManager = () => {
  const { data: options, refetch } = useOptions(false); // Pass false to get all options including inactive ones
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<Option | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const addOptionForm = useForm<OptionFormValues>({
    defaultValues: {
      name: "",
      description: "",
      pricing_type: 'per_person',
      price_per_person: 0,
      flat_price: null,
      is_active: true,
    },
  });
  
  const editOptionForm = useForm<OptionFormValues>({
    defaultValues: {
      name: "",
      description: "",
      pricing_type: 'per_person',
      price_per_person: 0,
      flat_price: null,
      is_active: true,
    },
  });

  useEffect(() => {
    if (editingOption) {
      editOptionForm.reset({
        name: editingOption.name,
        description: editingOption.description || "",
        pricing_type: editingOption.pricing_type,
        price_per_person: editingOption.price_per_person,
        flat_price: editingOption.flat_price,
        is_active: editingOption.is_active,
      });
    }
  }, [editingOption]);

  const handleAddOption = async (values: OptionFormValues) => {
    setIsLoading(true);
    try {
      console.log("Form values:", values);
      
      // pricing_typeに応じて適切なフィールドを設定
      const insertData = {
        name: values.name,
        description: values.description || null,
        pricing_type: values.pricing_type,
        price_per_person: values.pricing_type === 'flat' ? 0 : (values.price_per_person || 0),
        flat_price: values.pricing_type === 'flat' ? (values.flat_price || 0) : null,
        is_active: values.is_active,
      };
      
      console.log("Insert data:", insertData);
      
      const { error } = await supabase.from("options").insert(insertData);

      if (error) throw error;
      
      toast.success("オプションを追加しました");
      addOptionForm.reset();
      setIsAddDialogOpen(false);
      refetch();
    } catch (error) {
      console.error("Error adding option:", error);
      toast.error("オプションの追加に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditOption = async (values: OptionFormValues) => {
    if (!editingOption) return;
    
    setIsLoading(true);
    try {
      // pricing_typeに応じて適切なフィールドを設定
      const updateData = {
        name: values.name,
        description: values.description || null,
        pricing_type: values.pricing_type,
        price_per_person: values.pricing_type === 'flat' ? 0 : values.price_per_person,
        flat_price: values.pricing_type === 'flat' ? values.flat_price : null,
        is_active: values.is_active,
      };
      
      console.log("Updating option:", editingOption.id, "with data:", updateData);
      
      const { error } = await supabase
        .from("options")
        .update(updateData)
        .eq("id", editingOption.id);

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      
      toast.success("オプションを更新しました");
      setIsEditDialogOpen(false);
      setEditingOption(null);
      refetch();
    } catch (error) {
      console.error("Error updating option:", error);
      toast.error("オプションの更新に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async (option: Option) => {
    try {
      const { error } = await supabase
        .from("options")
        .update({ is_active: !option.is_active })
        .eq("id", option.id);

      if (error) throw error;
      
      toast.success(`オプションを${option.is_active ? '無効' : '有効'}にしました`);
      refetch();
    } catch (error) {
      console.error("Error toggling option status:", error);
      toast.error("オプションのステータス変更に失敗しました");
    }
  };

  const openEditDialog = (option: Option) => {
    setEditingOption(option);
    setIsEditDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">オプション管理</h2>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              新規オプション追加
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>オプションの追加</DialogTitle>
            </DialogHeader>
            <Form {...addOptionForm}>
              <form onSubmit={addOptionForm.handleSubmit(handleAddOption)} className="space-y-6">
                <FormField
                  control={addOptionForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>オプション名</FormLabel>
                      <FormControl>
                        <Input placeholder="例：タオルセット" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addOptionForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>説明（任意）</FormLabel>
                      <FormControl>
                        <Textarea placeholder="説明を入力" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addOptionForm.control}
                  name="pricing_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>料金タイプ</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="per_person">一人あたり料金（数量選択可）</SelectItem>
                            <SelectItem value="per_guest">一人あたり料金（予約人数に自動適用）</SelectItem>
                            <SelectItem value="flat">一律料金</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {(addOptionForm.watch("pricing_type") === "per_person" || addOptionForm.watch("pricing_type") === "per_guest") ? (
                  <FormField
                    control={addOptionForm.control}
                    name="price_per_person"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>1人あたり料金（円）</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0" 
                            placeholder="500" 
                            {...field} 
                            value={field.value} 
                            onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <FormField
                    control={addOptionForm.control}
                    name="flat_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>一律料金（円）</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0" 
                            placeholder="3000" 
                            {...field} 
                            value={field.value || ""} 
                            onChange={(e) => field.onChange(parseInt(e.target.value, 10) || null)} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={addOptionForm.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>有効</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button 
                    type="submit" 
                    disabled={isLoading}
                  >
                    {isLoading ? "追加中..." : "追加する"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>オプション名</TableHead>
              <TableHead>説明</TableHead>
              <TableHead>料金タイプ</TableHead>
              <TableHead>料金</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {options?.map((option) => (
              <TableRow key={option.id}>
                <TableCell>{option.name}</TableCell>
                <TableCell>{option.description || "-"}</TableCell>
                <TableCell>
                  {option.pricing_type === 'per_person' ? '一人あたり（選択可）' : 
                   option.pricing_type === 'per_guest' ? '一人あたり（自動）' : '一律'}
                </TableCell>
                <TableCell>
                  {(option.pricing_type === 'per_person' || option.pricing_type === 'per_guest')
                    ? `${formatPrice(option.price_per_person)} / 人`
                    : formatPrice(option.flat_price || 0)}
                </TableCell>
                <TableCell>
                  <span 
                    className={`px-2 py-1 text-xs rounded-full ${
                      option.is_active 
                        ? "bg-green-100 text-green-800" 
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {option.is_active ? "有効" : "無効"}
                  </span>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(option)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleActive(option)}
                  >
                    {option.is_active ? "無効にする" : "有効にする"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {options?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4">
                  オプションがありません。新しいオプションを追加してください。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) {
          setEditingOption(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>オプションの編集</DialogTitle>
          </DialogHeader>
          {editingOption && (
            <Form {...editOptionForm}>
              <form onSubmit={editOptionForm.handleSubmit(handleEditOption)} className="space-y-6">
                <FormField
                  control={editOptionForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>オプション名</FormLabel>
                      <FormControl>
                        <Input placeholder="例：タオルセット" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editOptionForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>説明（任意）</FormLabel>
                      <FormControl>
                        <Textarea placeholder="説明を入力" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editOptionForm.control}
                  name="pricing_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>料金タイプ</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="per_person">一人あたり料金（数量選択可）</SelectItem>
                            <SelectItem value="per_guest">一人あたり料金（予約人数に自動適用）</SelectItem>
                            <SelectItem value="flat">一律料金</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {(editOptionForm.watch("pricing_type") === "per_person" || editOptionForm.watch("pricing_type") === "per_guest") ? (
                  <FormField
                    control={editOptionForm.control}
                    name="price_per_person"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>1人あたり料金（円）</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0" 
                            placeholder="500" 
                            {...field} 
                            value={field.value}
                            onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <FormField
                    control={editOptionForm.control}
                    name="flat_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>一律料金（円）</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0" 
                            placeholder="3000" 
                            {...field} 
                            value={field.value || ""}
                            onChange={(e) => field.onChange(parseInt(e.target.value, 10) || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={editOptionForm.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>有効</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button 
                    type="submit" 
                    disabled={isLoading}
                  >
                    {isLoading ? "更新中..." : "更新する"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

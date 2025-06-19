import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Save, X } from "lucide-react";
import { useCompany } from "@/hooks/useCompany";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { usePageActions } from "@/hooks/usePageActions";

interface Account {
  id: number;
  code: string;
  name: string;
  type: string;
}

interface JournalEntry {
  id: number;
  entryNumber: string;
  date: string;
  description: string;
  reference: string | null;
  totalAmount: string;
  isPosted: boolean;
  createdAt: string;
}

interface JournalEntryLine {
  id: number;
  accountId: number;
  description: string | null;
  debitAmount: string;
  creditAmount: string;
}

const journalEntryLineSchema = z.object({
  accountId: z.number().min(1, "Account is required"),
  description: z.string().optional(),
  debitAmount: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, "Must be a valid positive number"),
  creditAmount: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, "Must be a valid positive number"),
});

const journalEntrySchema = z.object({
  entryNumber: z.string().min(1, "Entry number is required"),
  date: z.string().min(1, "Date is required"),
  description: z.string().min(1, "Description is required"),
  reference: z.string().optional(),
  lines: z.array(journalEntryLineSchema).min(2, "At least 2 lines are required").refine(
    (lines) => {
      const totalDebits = lines.reduce((sum, line) => sum + parseFloat(line.debitAmount || '0'), 0);
      const totalCredits = lines.reduce((sum, line) => sum + parseFloat(line.creditAmount || '0'), 0);
      return Math.abs(totalDebits - totalCredits) < 0.01;
    },
    "Total debits must equal total credits"
  ),
});

type JournalEntryForm = z.infer<typeof journalEntrySchema>;

export default function JournalEntries() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { registerTrigger } = usePageActions();

  // Register the action for this page
  useEffect(() => {
    registerTrigger('newJournalEntry', () => {
      setIsDialogOpen(true);
    });
  }, [registerTrigger]);

  const { data: journalEntries, isLoading: entriesLoading } = useQuery<JournalEntry[]>({
    queryKey: ['/api/journal-entries'],
    enabled: !!currentCompany,
  });

  const { data: accounts, isLoading: accountsLoading } = useQuery<Account[]>({
    queryKey: ['/api/accounts'],
    enabled: !!currentCompany,
  });

  const form = useForm<JournalEntryForm>({
    resolver: zodResolver(journalEntrySchema),
    defaultValues: {
      entryNumber: "",
      date: new Date().toISOString().split('T')[0],
      description: "",
      reference: "",
      lines: [
        { accountId: 0, description: "", debitAmount: "0.00", creditAmount: "0.00" },
        { accountId: 0, description: "", debitAmount: "0.00", creditAmount: "0.00" },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const createEntryMutation = useMutation({
    mutationFn: async (data: JournalEntryForm) => {
      const totalAmount = data.lines.reduce((sum, line) => sum + parseFloat(line.debitAmount || '0'), 0);
      
      const entryResponse = await apiRequest('POST', '/api/journal-entries', {
        entryNumber: data.entryNumber,
        date: new Date(data.date).toISOString(),
        description: data.description,
        reference: data.reference || null,
        totalAmount: totalAmount.toString(),
      });
      
      const entry = await entryResponse.json();
      
      // Create journal entry lines
      for (const line of data.lines) {
        if (line.accountId && (parseFloat(line.debitAmount) > 0 || parseFloat(line.creditAmount) > 0)) {
          await apiRequest('POST', '/api/journal-entry-lines', {
            journalEntryId: entry.id,
            accountId: line.accountId,
            description: line.description || null,
            debitAmount: line.debitAmount,
            creditAmount: line.creditAmount,
          });
        }
      }
      
      return entry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/journal-entries'] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Journal entry created",
        description: "The journal entry has been successfully created.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create journal entry",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: JournalEntryForm) => {
    createEntryMutation.mutate(data);
  };

  const addLine = () => {
    append({ accountId: 0, description: "", debitAmount: "0.00", creditAmount: "0.00" });
  };

  const calculateTotals = () => {
    const lines = form.watch("lines");
    const totalDebits = lines.reduce((sum, line) => sum + parseFloat(line.debitAmount || '0'), 0);
    const totalCredits = lines.reduce((sum, line) => sum + parseFloat(line.creditAmount || '0'), 0);
    return { totalDebits, totalCredits };
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (!currentCompany) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-medium text-foreground">No Company Selected</h3>
          <p className="text-muted-foreground">Please select a company to manage journal entries.</p>
        </div>
      </div>
    );
  }

  const { totalDebits, totalCredits } = calculateTotals();
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Journal Entries</h1>
          <p className="text-muted-foreground">
            Create and manage manual accounting entries
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Journal Entry</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="entryNumber">Entry Number</Label>
                  <Input
                    id="entryNumber"
                    {...form.register("entryNumber")}
                    placeholder="JE-001"
                  />
                  {form.formState.errors.entryNumber && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.entryNumber.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    {...form.register("date")}
                  />
                  {form.formState.errors.date && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.date.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...form.register("description")}
                  placeholder="Enter journal entry description"
                  rows={2}
                />
                {form.formState.errors.description && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.description.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="reference">Reference (Optional)</Label>
                <Input
                  id="reference"
                  {...form.register("reference")}
                  placeholder="Reference number or document"
                />
              </div>

              {/* Journal Entry Lines */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Journal Entry Lines</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addLine}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Line
                  </Button>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fields.map((field, index) => (
                        <TableRow key={field.id}>
                          <TableCell className="w-64">
                            <Select
                              value={form.watch(`lines.${index}.accountId`).toString()}
                              onValueChange={(value) => form.setValue(`lines.${index}.accountId`, parseInt(value))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select account" />
                              </SelectTrigger>
                              <SelectContent>
                                {accounts?.map((account) => (
                                  <SelectItem key={account.id} value={account.id.toString()}>
                                    {account.code} - {account.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              {...form.register(`lines.${index}.description`)}
                              placeholder="Line description"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              {...form.register(`lines.${index}.debitAmount`)}
                              type="number"
                              step="0.01"
                              min="0"
                              className="text-right"
                              placeholder="0.00"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              {...form.register(`lines.${index}.creditAmount`)}
                              type="number"
                              step="0.01"
                              min="0"
                              className="text-right"
                              placeholder="0.00"
                            />
                          </TableCell>
                          <TableCell>
                            {fields.length > 2 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => remove(index)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Totals */}
                <div className="flex justify-end space-x-8 pt-4 border-t">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Total Debits</p>
                    <p className="font-medium">{formatCurrency(totalDebits.toString())}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Total Credits</p>
                    <p className="font-medium">{formatCurrency(totalCredits.toString())}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Difference</p>
                    <p className={`font-medium ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(Math.abs(totalDebits - totalCredits).toString())}
                    </p>
                  </div>
                </div>

                {!isBalanced && (
                  <p className="text-sm text-destructive">
                    Total debits must equal total credits
                  </p>
                )}

                {form.formState.errors.lines && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.lines.message}
                  </p>
                )}
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createEntryMutation.isPending || !isBalanced}>
                  {createEntryMutation.isPending ? "Creating..." : "Create Entry"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Journal Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {entriesLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Loading journal entries...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Entry Number</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {journalEntries && journalEntries.length > 0 ? (
                  journalEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatDate(entry.date)}</TableCell>
                      <TableCell className="font-mono">{entry.entryNumber}</TableCell>
                      <TableCell>{entry.description}</TableCell>
                      <TableCell>{entry.reference || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={entry.isPosted ? "default" : "secondary"}>
                          {entry.isPosted ? "Posted" : "Draft"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(entry.totalAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button variant="ghost" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                          {!entry.isPosted && (
                            <Button variant="ghost" size="sm" className="text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No journal entries found. Create your first entry to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

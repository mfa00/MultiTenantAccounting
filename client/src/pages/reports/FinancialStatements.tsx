import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { FileText, Download, Printer, Calendar } from "lucide-react";
import { useCompany } from "@/hooks/useCompany";

interface Account {
  id: number;
  code: string;
  name: string;
  type: string;
  subType: string | null;
}

interface FinancialData {
  account: string;
  amount: number;
  type: string;
}

export default function FinancialStatements() {
  const [reportType, setReportType] = useState("profit-loss");
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const { currentCompany } = useCompany();

  const { data: accounts, isLoading: accountsLoading } = useQuery<Account[]>({
    queryKey: ['/api/accounts'],
    enabled: !!currentCompany,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Mock data for demonstration - in production, this would come from actual transaction data
  const generateMockData = (type: string) => {
    if (type === "profit-loss") {
      return [
        { category: "Revenue", accounts: [
          { name: "Sales Revenue", amount: 125430 },
          { name: "Service Revenue", amount: 35200 },
          { name: "Other Revenue", amount: 2800 },
        ]},
        { category: "Cost of Goods Sold", accounts: [
          { name: "Cost of Materials", amount: 45600 },
          { name: "Direct Labor", amount: 28300 },
        ]},
        { category: "Operating Expenses", accounts: [
          { name: "Rent Expense", amount: 8000 },
          { name: "Utilities Expense", amount: 1200 },
          { name: "Office Supplies", amount: 850 },
          { name: "Professional Services", amount: 3200 },
          { name: "Insurance Expense", amount: 1500 },
        ]},
      ];
    } else if (type === "balance-sheet") {
      return [
        { category: "Assets", subcategories: [
          { name: "Current Assets", accounts: [
            { name: "Cash and Cash Equivalents", amount: 45120 },
            { name: "Accounts Receivable", amount: 28940 },
            { name: "Inventory", amount: 15600 },
            { name: "Prepaid Expenses", amount: 3200 },
          ]},
          { name: "Fixed Assets", accounts: [
            { name: "Equipment", amount: 85000 },
            { name: "Accumulated Depreciation - Equipment", amount: -12000 },
            { name: "Furniture and Fixtures", amount: 25000 },
            { name: "Accumulated Depreciation - Furniture", amount: -5000 },
          ]},
        ]},
        { category: "Liabilities", subcategories: [
          { name: "Current Liabilities", accounts: [
            { name: "Accounts Payable", amount: 18500 },
            { name: "Accrued Expenses", amount: 4200 },
            { name: "Short-term Loans", amount: 15000 },
          ]},
          { name: "Long-term Liabilities", accounts: [
            { name: "Long-term Debt", amount: 75000 },
          ]},
        ]},
        { category: "Equity", subcategories: [
          { name: "Owner's Equity", accounts: [
            { name: "Capital", amount: 50000 },
            { name: "Retained Earnings", amount: 42160 },
          ]},
        ]},
      ];
    }
    return [];
  };

  const renderProfitLoss = () => {
    const data = generateMockData("profit-loss");
    let totalRevenue = 0;
    let totalCOGS = 0;
    let totalExpenses = 0;

    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">{currentCompany?.name}</h2>
          <h3 className="text-xl font-semibold">Profit & Loss Statement</h3>
          <p className="text-muted-foreground">
            For the period {formatDate(startDate)} to {formatDate(endDate)}
          </p>
        </div>

        <div className="space-y-6">
          {data.map((section, index) => (
            <div key={index}>
              <h4 className="font-semibold text-lg mb-3">{section.category}</h4>
              <Table>
                <TableBody>
                  {section.accounts.map((account, accountIndex) => {
                    if (section.category === "Revenue") totalRevenue += account.amount;
                    else if (section.category === "Cost of Goods Sold") totalCOGS += account.amount;
                    else if (section.category === "Operating Expenses") totalExpenses += account.amount;

                    return (
                      <TableRow key={accountIndex}>
                        <TableCell className="pl-4">{account.name}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(account.amount)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              
              {section.category === "Revenue" && (
                <div className="mt-2 pt-2 border-t">
                  <div className="flex justify-between font-semibold">
                    <span>Total Revenue</span>
                    <span>{formatCurrency(totalRevenue)}</span>
                  </div>
                </div>
              )}
              
              {section.category === "Cost of Goods Sold" && (
                <div className="mt-2 pt-2 border-t">
                  <div className="flex justify-between font-semibold">
                    <span>Total Cost of Goods Sold</span>
                    <span>{formatCurrency(totalCOGS)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg mt-2">
                    <span>Gross Profit</span>
                    <span>{formatCurrency(totalRevenue - totalCOGS)}</span>
                  </div>
                </div>
              )}
              
              {section.category === "Operating Expenses" && (
                <div className="mt-2 pt-2 border-t">
                  <div className="flex justify-between font-semibold">
                    <span>Total Operating Expenses</span>
                    <span>{formatCurrency(totalExpenses)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t">
                    <span>Net Income</span>
                    <span className={totalRevenue - totalCOGS - totalExpenses >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {formatCurrency(totalRevenue - totalCOGS - totalExpenses)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderBalanceSheet = () => {
    const data = generateMockData("balance-sheet");
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">{currentCompany?.name}</h2>
          <h3 className="text-xl font-semibold">Balance Sheet</h3>
          <p className="text-muted-foreground">
            As of {formatDate(endDate)}
          </p>
        </div>

        <div className="space-y-6">
          {data.map((section, index) => (
            <div key={index}>
              <h4 className="font-semibold text-lg mb-3">{section.category}</h4>
              
              {section.subcategories?.map((subcategory, subIndex) => {
                const subcategoryTotal = subcategory.accounts.reduce((sum, account) => sum + account.amount, 0);
                
                if (section.category === "Assets") totalAssets += subcategoryTotal;
                else if (section.category === "Liabilities") totalLiabilities += subcategoryTotal;
                else if (section.category === "Equity") totalEquity += subcategoryTotal;

                return (
                  <div key={subIndex} className="mb-4">
                    <h5 className="font-medium text-base mb-2 pl-2">{subcategory.name}</h5>
                    <Table>
                      <TableBody>
                        {subcategory.accounts.map((account, accountIndex) => (
                          <TableRow key={accountIndex}>
                            <TableCell className="pl-6">{account.name}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(account.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="mt-2 pt-2 border-t">
                      <div className="flex justify-between font-semibold pl-2">
                        <span>Total {subcategory.name}</span>
                        <span>{formatCurrency(subcategoryTotal)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              <div className="mt-4 pt-2 border-t-2 border-black">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total {section.category}</span>
                  <span>
                    {section.category === "Assets" && formatCurrency(totalAssets)}
                    {section.category === "Liabilities" && formatCurrency(totalLiabilities)}
                    {section.category === "Equity" && formatCurrency(totalEquity)}
                  </span>
                </div>
              </div>
            </div>
          ))}
          
          <div className="mt-6 pt-4 border-t-2 border-black">
            <div className="flex justify-between font-bold text-lg">
              <span>Total Liabilities and Equity</span>
              <span>{formatCurrency(totalLiabilities + totalEquity)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTrialBalance = () => {
    if (!accounts) return null;

    // Group accounts by type for trial balance
    const accountsByType = accounts.reduce((acc, account) => {
      if (!acc[account.type]) {
        acc[account.type] = [];
      }
      acc[account.type].push(account);
      return acc;
    }, {} as Record<string, Account[]>);

    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">{currentCompany?.name}</h2>
          <h3 className="text-xl font-semibold">Trial Balance</h3>
          <p className="text-muted-foreground">
            As of {formatDate(endDate)}
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account Code</TableHead>
              <TableHead>Account Name</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(accountsByType).map(([type, typeAccounts]) => (
              <>
                <TableRow key={type}>
                  <TableCell colSpan={4} className="font-semibold bg-muted">
                    {type.charAt(0).toUpperCase() + type.slice(1)} Accounts
                  </TableCell>
                </TableRow>
                {typeAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-mono">{account.code}</TableCell>
                    <TableCell>{account.name}</TableCell>
                    <TableCell className="text-right">
                      {['asset', 'expense'].includes(account.type) ? '$0.00' : ''}
                    </TableCell>
                    <TableCell className="text-right">
                      {['liability', 'equity', 'revenue'].includes(account.type) ? '$0.00' : ''}
                    </TableCell>
                  </TableRow>
                ))}
              </>
            ))}
            <TableRow className="font-bold border-t-2">
              <TableCell colSpan={2}>TOTALS</TableCell>
              <TableCell className="text-right">$0.00</TableCell>
              <TableCell className="text-right">$0.00</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  };

  if (!currentCompany) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-medium text-foreground">No Company Selected</h3>
          <p className="text-muted-foreground">Please select a company to view financial statements.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Financial Statements</h1>
          <p className="text-muted-foreground">
            Generate and view financial reports
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Report Parameters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Report Parameters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reportType">Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="profit-loss">Profit & Loss</SelectItem>
                  <SelectItem value="balance-sheet">Balance Sheet</SelectItem>
                  <SelectItem value="trial-balance">Trial Balance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financial Statement Content */}
      <Card>
        <CardContent className="p-8">
          {accountsLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Loading financial data...</p>
            </div>
          ) : (
            <div>
              {reportType === "profit-loss" && renderProfitLoss()}
              {reportType === "balance-sheet" && renderBalanceSheet()}
              {reportType === "trial-balance" && renderTrialBalance()}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

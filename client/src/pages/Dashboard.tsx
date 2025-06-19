import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, File, University, Receipt, Plus, Edit, TrendingUp, Clock, ChevronRight } from "lucide-react";
import { useCompany } from "@/hooks/useCompany";

interface DashboardMetrics {
  totalRevenue: number;
  outstandingInvoices: number;
  cashBalance: number;
  monthlyExpenses: number;
}

interface Transaction {
  id: number;
  entryNumber: string;
  date: string;
  description: string;
  totalAmount: string;
  isPosted: boolean;
}

export default function Dashboard() {
  const { currentCompany } = useCompany();

  const { data: metrics, isLoading: metricsLoading } = useQuery<DashboardMetrics>({
    queryKey: ['/api/dashboard/metrics'],
    enabled: !!currentCompany,
  });

  const { data: recentTransactions, isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ['/api/dashboard/recent-transactions'],
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
      month: 'short',
      day: 'numeric',
    });
  };

  const quickActions = [
    {
      title: "Create Invoice",
      description: "Bill your customers",
      icon: Plus,
      iconBg: "bg-blue-100 text-blue-600",
      href: "/invoices",
    },
    {
      title: "Record Payment",
      description: "Log incoming payments",
      icon: DollarSign,
      iconBg: "bg-green-100 text-green-600",
      href: "/payments",
    },
    {
      title: "Journal Entry",
      description: "Manual accounting entry",
      icon: Edit,
      iconBg: "bg-yellow-100 text-yellow-600",
      href: "/journal-entries",
    },
    {
      title: "Bank Reconciliation",
      description: "Match transactions",
      icon: University,
      iconBg: "bg-red-100 text-red-600",
      href: "/bank-reconciliation",
    },
  ];

  if (!currentCompany) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-medium text-foreground">No Company Selected</h3>
          <p className="text-muted-foreground">Please select a company to view the dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="metric-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="metric-label">Total Revenue</p>
                <p className="metric-value">
                  {metricsLoading ? "..." : formatCurrency(metrics?.totalRevenue || 0)}
                </p>
                <p className="metric-change positive">
                  <TrendingUp className="w-3 h-3 inline mr-1" />
                  +12.5% from last month
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="text-green-600 text-xl" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="metric-label">Outstanding Invoices</p>
                <p className="metric-value">
                  {metricsLoading ? "..." : formatCurrency(metrics?.outstandingInvoices || 0)}
                </p>
                <p className="metric-change warning">
                  <Clock className="w-3 h-3 inline mr-1" />
                  15 invoices pending
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <File className="text-yellow-600 text-xl" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="metric-label">Cash Balance</p>
                <p className="metric-value">
                  {metricsLoading ? "..." : formatCurrency(metrics?.cashBalance || 0)}
                </p>
                <p className="metric-change neutral">
                  Across 3 accounts
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <University className="text-blue-600 text-xl" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="metric-label">Monthly Expenses</p>
                <p className="metric-value">
                  {metricsLoading ? "..." : formatCurrency(metrics?.monthlyExpenses || 0)}
                </p>
                <p className="metric-change negative">
                  <TrendingUp className="w-3 h-3 inline mr-1" />
                  +5.2% from last month
                </p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <Receipt className="text-red-600 text-xl" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart Placeholder */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Revenue Trend</CardTitle>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" className="bg-primary text-primary-foreground">
                  6M
                </Button>
                <Button variant="outline" size="sm">
                  1Y
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-muted rounded-lg flex items-center justify-center">
              <div className="text-center">
                <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Revenue chart will be implemented</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={index}
                    variant="ghost"
                    className="quick-action-button"
                    onClick={() => {
                      // Navigation will be implemented
                      console.log(`Navigate to ${action.href}`);
                    }}
                  >
                    <div className={`quick-action-icon ${action.iconBg}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-foreground">{action.title}</p>
                      <p className="text-sm text-muted-foreground">{action.description}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Transactions</CardTitle>
            <Button variant="ghost" className="text-primary hover:text-primary/80">
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {transactionsLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Loading transactions...</p>
            </div>
          ) : (
            <Table className="transaction-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Entry Number</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTransactions && recentTransactions.length > 0 ? (
                  recentTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>{formatDate(transaction.date)}</TableCell>
                      <TableCell className="font-medium">{transaction.entryNumber}</TableCell>
                      <TableCell>{transaction.description}</TableCell>
                      <TableCell>
                        <Badge className={`status-badge ${transaction.isPosted ? 'income' : 'expense'}`}>
                          {transaction.isPosted ? 'Posted' : 'Draft'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(parseFloat(transaction.totalAmount))}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No transactions found. Create your first journal entry to get started.
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

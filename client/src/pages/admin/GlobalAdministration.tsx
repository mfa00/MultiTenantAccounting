import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { 
  Plus, Edit, Trash2, Save, X, Shield, Building2, Users, Database, 
  Activity, BarChart3, Settings, Globe, UserPlus, Building, Eye,
  Download, Upload, RefreshCw, AlertTriangle, CheckCircle, XCircle,
  Calendar, Clock, TrendingUp, Server, HardDrive
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Role, GlobalRole } from "@shared/permissions";

interface Company {
  id: number;
  name: string;
  code: string;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  userCount: number;
  lastActivity: string | null;
}

interface GlobalUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  globalRole: GlobalRole;
  isActive: boolean;
  createdAt: string;
  lastLogin: string | null;
  companiesCount: number;
}

interface SystemStats {
  totalCompanies: number;
  activeCompanies: number;
  totalUsers: number;
  activeUsers: number;
  totalTransactions: number;
  storageUsed: string;
  systemUptime: string;
  lastBackup: string | null;
}

interface ActivityLog {
  id: number;
  userId: number;
  userName: string;
  action: string;
  resource: string;
  details: string | null;
  timestamp: string;
  ipAddress: string | null;
}

const companySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  code: z.string().min(1, "Company code is required").max(10, "Code must be 10 characters or less"),
  description: z.string().optional(),
});

const globalUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal("")),
  globalRole: z.enum(['global_administrator', 'user']),
});

type CompanyForm = z.infer<typeof companySchema>;
type GlobalUserForm = z.infer<typeof globalUserSchema>;

export default function GlobalAdministration() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isCompanyDialogOpen, setIsCompanyDialogOpen] = useState(false);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editingUser, setEditingUser] = useState<GlobalUser | null>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Queries
  const { data: systemStats, isLoading: statsLoading } = useQuery<SystemStats>({
    queryKey: ['/api/global-admin/stats'],
    queryFn: async () => {
      const response = await fetch('/api/global-admin/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch system stats');
      }
      return response.json();
    },
  });

  const { data: companies = [], isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ['/api/global-admin/companies'],
    queryFn: async () => {
      const response = await fetch('/api/global-admin/companies');
      if (!response.ok) {
        throw new Error('Failed to fetch companies');
      }
      return response.json();
    },
  });

  const { data: globalUsers = [], isLoading: usersLoading } = useQuery<GlobalUser[]>({
    queryKey: ['/api/global-admin/users'],
    queryFn: async () => {
      const response = await fetch('/api/global-admin/users');
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      return response.json();
    },
  });

  // Activity logs state
  const [activityFilters, setActivityFilters] = useState({
    page: 1,
    limit: 50,
    action: 'all',
    resource: 'all',
    userId: 'all',
    startDate: '',
    endDate: '',
    search: ''
  });

  const { data: activityData, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['/api/activity-logs', activityFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(activityFilters).forEach(([key, value]) => {
        // Don't include "all" values or empty strings in the API request
        if (value && value !== 'all') {
          params.append(key, value.toString());
        }
      });
      
      const response = await fetch(`/api/activity-logs?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch activity logs');
      }
      return response.json();
    },
  });

  const { data: activityFiltersData } = useQuery({
    queryKey: ['/api/activity-logs/filters'],
    queryFn: async () => {
      const response = await fetch('/api/activity-logs/filters');
      if (!response.ok) {
        throw new Error('Failed to fetch filter options');
      }
      return response.json();
    },
  });

  const { data: activitySummary } = useQuery({
    queryKey: ['/api/activity-logs/summary'],
    queryFn: async () => {
      const response = await fetch('/api/activity-logs/summary?days=7');
      if (!response.ok) {
        throw new Error('Failed to fetch activity summary');
      }
      return response.json();
    },
  });

  // Form handling
  const companyForm = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
    },
  });

  const userForm = useForm<GlobalUserForm>({
    resolver: zodResolver(globalUserSchema),
    defaultValues: {
      username: "",
      email: "",
      firstName: "",
      lastName: "",
      password: "",
      globalRole: "user",
    },
  });

  // Mutations
  const createCompanyMutation = useMutation({
    mutationFn: (data: CompanyForm) => apiRequest('POST', '/api/global-admin/companies', data),
    onSuccess: () => {
      console.log('Company created, invalidating queries...');
      queryClient.invalidateQueries({ queryKey: ['/api/global-admin/companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/global-admin/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/global-admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/global-admin/activity'] });
      setIsCompanyDialogOpen(false);
      companyForm.reset();
      toast({
        title: "Company created",
        description: "The company has been successfully created.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create company",
        variant: "destructive",
      });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CompanyForm }) => 
      apiRequest('PUT', `/api/global-admin/companies/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/global-admin/companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/global-admin/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/global-admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/global-admin/activity'] });
      setEditingCompany(null);
      setIsCompanyDialogOpen(false);
      companyForm.reset();
      toast({
        title: "Company updated",
        description: "The company has been successfully updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update company",
        variant: "destructive",
      });
    },
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/global-admin/companies/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/global-admin/companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/global-admin/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/global-admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/global-admin/activity'] });
      toast({
        title: "Company deleted",
        description: "The company has been successfully deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete company",
        variant: "destructive",
      });
    },
  });

  const createGlobalUserMutation = useMutation({
    mutationFn: (data: GlobalUserForm) => apiRequest('POST', '/api/global-admin/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/global-admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/global-admin/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/global-admin/companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/global-admin/activity'] });
      setIsUserDialogOpen(false);
      userForm.reset();
      toast({
        title: "User created",
        description: "The global user has been successfully created.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    },
  });

  const updateGlobalUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<GlobalUserForm> }) => 
      apiRequest('PUT', `/api/global-admin/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/global-admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/global-admin/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/global-admin/companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/global-admin/activity'] });
      setEditingUser(null);
      setIsUserDialogOpen(false);
      userForm.reset();
      toast({
        title: "User updated",
        description: "The user has been successfully updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    },
  });

  const toggleUserStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => 
      apiRequest('PUT', `/api/global-admin/users/${id}/status`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/global-admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/global-admin/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/global-admin/activity'] });
      toast({
        title: "User status updated",
        description: "The user status has been successfully changed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user status",
        variant: "destructive",
      });
    },
  });

  const toggleCompanyStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => 
      apiRequest('PUT', `/api/global-admin/companies/${id}/status`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/global-admin/companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/global-admin/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/global-admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/global-admin/activity'] });
      toast({
        title: "Company status updated",
        description: "The company status has been successfully changed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update company status",
        variant: "destructive",
      });
    },
  });

  const deleteGlobalUserMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/global-admin/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/global-admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/global-admin/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/global-admin/companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/global-admin/activity'] });
      toast({
        title: "User deleted",
        description: "The user has been successfully deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  // Helper functions
  const handleEditCompany = (company: Company) => {
    setEditingCompany(company);
    companyForm.setValue("name", company.name);
    companyForm.setValue("code", company.code);
    companyForm.setValue("description", company.address || "");
    setIsCompanyDialogOpen(true);
  };

  const handleCreateCompany = () => {
    setEditingCompany(null);
    companyForm.reset();
    setIsCompanyDialogOpen(true);
  };

  const handleEditUser = (user: GlobalUser) => {
    setEditingUser(user);
    userForm.setValue("username", user.username);
    userForm.setValue("email", user.email);
    userForm.setValue("firstName", user.firstName);
    userForm.setValue("lastName", user.lastName);
    userForm.setValue("globalRole", user.globalRole);
    // Don't pre-fill password for editing
    setIsUserDialogOpen(true);
  };

  const handleCreateUser = () => {
    setEditingUser(null);
    userForm.reset();
    setIsUserDialogOpen(true);
  };

  const onCompanySubmit = (data: CompanyForm) => {
    // Prevent form submission if already processing
    if (createCompanyMutation.isPending || updateCompanyMutation.isPending) {
      return;
    }

    try {
    if (editingCompany) {
      updateCompanyMutation.mutate({ id: editingCompany.id, data });
    } else {
      createCompanyMutation.mutate(data);
      }
    } catch (error) {
      console.error('Form submission error:', error);
      toast({
        title: "Error",
        description: "Failed to submit form. Please try again.",
        variant: "destructive",
      });
    }
  };

  const onUserSubmit = (data: GlobalUserForm) => {
    // Prevent form submission if already processing
    if (createGlobalUserMutation.isPending || updateGlobalUserMutation.isPending) {
      return;
    }

    try {
    if (editingUser) {
        // For editing, password is optional
        const updateData: Partial<GlobalUserForm> = { ...data };
        if (!data.password || data.password.trim() === '') {
          // Don't update password if empty
          const { password, ...dataWithoutPassword } = updateData;
          updateGlobalUserMutation.mutate({ id: editingUser.id, data: dataWithoutPassword });
        } else {
      updateGlobalUserMutation.mutate({ id: editingUser.id, data: updateData });
        }
    } else {
        // For creating, password is required
        if (!data.password || data.password.trim() === '') {
          toast({
            title: "Error",
            description: "Password is required when creating a new user.",
            variant: "destructive",
          });
          return;
        }
        createGlobalUserMutation.mutate(data as Required<GlobalUserForm>);
      }
    } catch (error) {
      console.error('User form submission error:', error);
      toast({
        title: "Error",
        description: "Failed to submit user form. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRoleColor = (role: GlobalRole) => {
    return role === 'global_administrator' ? 
      'bg-red-100 text-red-800' : 
      'bg-blue-100 text-blue-800';
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 
      'bg-green-100 text-green-800' : 
      'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center">
            <Globe className="w-6 h-6 mr-2" />
            Global Administration
          </h1>
          <p className="text-muted-foreground">
            Comprehensive system management and monitoring
          </p>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['/api/global-admin/companies'] });
              queryClient.invalidateQueries({ queryKey: ['/api/global-admin/users'] });
              queryClient.invalidateQueries({ queryKey: ['/api/global-admin/stats'] });
              queryClient.invalidateQueries({ queryKey: ['/api/global-admin/activity'] });
              toast({
                title: "Data refreshed",
                description: "All data has been refreshed from the server.",
              });
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </Button>
          <Button variant="outline">
            <Upload className="w-4 h-4 mr-2" />
            Backup System
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="companies">Companies</TabsTrigger>
          <TabsTrigger value="users">Global Users</TabsTrigger>
          <TabsTrigger value="activity">Activity Logs</TabsTrigger>
          <TabsTrigger value="system">System Health</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{systemStats?.totalCompanies || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {systemStats?.activeCompanies || 0} active
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{systemStats?.totalUsers || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {systemStats?.activeUsers || 0} active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Transactions</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{systemStats?.totalTransactions || 0}</div>
                <p className="text-xs text-muted-foreground">
                  This month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
                <HardDrive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{systemStats?.storageUsed || "0 MB"}</div>
                <p className="text-xs text-muted-foreground">
                  Database size
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Companies</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {companies.slice(0, 5).map((company) => (
                    <div key={company.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{company.name}</p>
                        <p className="text-sm text-muted-foreground">{company.code}</p>
                      </div>
                      <Badge className={getStatusColor(company.isActive)}>
                        {company.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span>System Uptime</span>
                    <Badge variant="outline">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      {systemStats?.systemUptime || "Unknown"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Last Backup</span>
                    <Badge variant="outline">
                      <Clock className="w-3 h-3 mr-1" />
                      {systemStats?.lastBackup ? formatDate(systemStats.lastBackup) : "Never"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Database Status</span>
                    <Badge variant="outline">
                      <CheckCircle className="w-3 h-3 mr-1 text-green-600" />
                      Healthy
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Companies Tab */}
        <TabsContent value="companies" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Company Management</h3>
              <p className="text-muted-foreground">Manage all companies in the system</p>
            </div>
            <Button onClick={handleCreateCompany}>
              <Plus className="w-4 h-4 mr-2" />
              New Company
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{company.name}</div>
                          {company.address && (
                            <div className="text-sm text-muted-foreground">
                              {company.address}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{company.code}</Badge>
                      </TableCell>
                      <TableCell>{company.userCount}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(company.isActive)}>
                          {company.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(company.createdAt)}</TableCell>
                      <TableCell>
                        {company.lastActivity ? formatDate(company.lastActivity) : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditCompany(company)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleCompanyStatusMutation.mutate({
                              id: company.id,
                              isActive: !company.isActive
                            })}
                          >
                            {company.isActive ? (
                              <XCircle className="w-4 h-4" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Company</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{company.name}"? This action cannot be undone and will remove all associated data.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteCompanyMutation.mutate(company.id)}
                                  className="bg-destructive text-destructive-foreground"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Global Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Global User Management</h3>
              <p className="text-muted-foreground">Manage system-wide user accounts and global roles</p>
            </div>
            <Button onClick={handleCreateUser}>
              <UserPlus className="w-4 h-4 mr-2" />
              New Global User
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Global Role</TableHead>
                    <TableHead>Companies</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {globalUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            @{user.username}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge className={getRoleColor(user.globalRole)}>
                          {user.globalRole === 'global_administrator' ? 'Global Admin' : 'User'}
                        </Badge>
                      </TableCell>
                      <TableCell>{user.companiesCount}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(user.isActive)}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.lastLogin ? formatDate(user.lastLogin) : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditUser(user)}
                            disabled={updateGlobalUserMutation.isPending}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleUserStatusMutation.mutate({
                              id: user.id,
                              isActive: !user.isActive
                            })}
                            disabled={toggleUserStatusMutation.isPending}
                          >
                            {user.isActive ? (
                              <XCircle className="w-4 h-4" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-destructive"
                                disabled={deleteGlobalUserMutation.isPending}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete User</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{user.firstName} {user.lastName}"? This action cannot be undone and will remove all associated data.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteGlobalUserMutation.mutate(user.id)}
                                  className="bg-destructive text-destructive-foreground"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Logs Tab */}
        <TabsContent value="activity" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">System Activity Logs</h3>
              <p className="text-muted-foreground">Monitor all system activities and user actions</p>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={() => refetchLogs()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export Logs
              </Button>
            </div>
          </div>

          {/* Activity Summary Cards */}
          {activitySummary?.data && (
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Actions</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {activitySummary.data.actionCounts?.reduce((sum: number, item: any) => sum + item.count, 0) || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last {activitySummary.data.period}
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Top Action</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {activitySummary.data.actionCounts?.[0]?.action || 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {activitySummary.data.actionCounts?.[0]?.count || 0} times
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Resources</CardTitle>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {activitySummary.data.resourceCounts?.length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Types affected
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Daily Average</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {Math.round((activitySummary.data.dailyCounts?.reduce((sum: number, item: any) => sum + item.count, 0) || 0) / (activitySummary.data.dailyCounts?.length || 1))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Actions per day
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-6">
                <div>
                  <Label htmlFor="search">Search</Label>
                  <Input
                    id="search"
                    placeholder="Search logs..."
                    value={activityFilters.search}
                    onChange={(e) => setActivityFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="action">Action</Label>
                  <Select
                    value={activityFilters.action}
                    onValueChange={(value) => setActivityFilters(prev => ({ ...prev, action: value, page: 1 }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All actions</SelectItem>
                      {activityFiltersData?.data?.actions?.map((action: any) => (
                        <SelectItem key={action.value} value={action.value}>
                          {action.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="resource">Resource</Label>
                  <Select
                    value={activityFilters.resource}
                    onValueChange={(value) => setActivityFilters(prev => ({ ...prev, resource: value, page: 1 }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by resource" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All resources</SelectItem>
                      {activityFiltersData?.data?.resources?.map((resource: any) => (
                        <SelectItem key={resource.value} value={resource.value}>
                          {resource.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="user">User</Label>
                  <Select
                    value={activityFilters.userId}
                    onValueChange={(value) => setActivityFilters(prev => ({ ...prev, userId: value, page: 1 }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by user" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All users</SelectItem>
                      {activityFiltersData?.data?.users?.map((user: any) => (
                        <SelectItem key={user.value} value={user.value.toString()}>
                          {user.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={activityFilters.startDate}
                    onChange={(e) => setActivityFilters(prev => ({ ...prev, startDate: e.target.value, page: 1 }))}
                  />
                </div>

                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={activityFilters.endDate}
                    onChange={(e) => setActivityFilters(prev => ({ ...prev, endDate: e.target.value, page: 1 }))}
                  />
                </div>
              </div>
              
              <div className="flex justify-between items-center mt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setActivityFilters({
                    page: 1,
                    limit: 50,
                    action: 'all',
                    resource: 'all',
                    userId: 'all',
                    startDate: '',
                    endDate: '',
                    search: ''
                  })}
                >
                  Clear Filters
                </Button>
                
                <div className="flex items-center space-x-2">
                  <Label htmlFor="limit">Per page:</Label>
                  <Select
                    value={activityFilters.limit.toString()}
                    onValueChange={(value) => setActivityFilters(prev => ({ ...prev, limit: parseInt(value), page: 1 }))}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Activity Logs Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Activity Logs</CardTitle>
                {activityData?.data?.pagination && (
                  <div className="text-sm text-muted-foreground">
                    Showing {((activityData.data.pagination.currentPage - 1) * activityData.data.pagination.limit) + 1} to {Math.min(activityData.data.pagination.currentPage * activityData.data.pagination.limit, activityData.data.pagination.totalCount)} of {activityData.data.pagination.totalCount} entries
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logsLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />
                          Loading activity logs...
                        </TableCell>
                      </TableRow>
                    ) : activityData?.data?.logs?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No activity logs found
                        </TableCell>
                      </TableRow>
                    ) : (
                      activityData?.data?.logs?.map((log: any) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-xs">
                            {log.formattedTimestamp}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{log.user?.name}</div>
                              <div className="text-xs text-muted-foreground">@{log.user?.username}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {log.actionDisplayName}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {log.resourceDisplayName}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <div className="space-y-1">
                              {log.details?.changes?.new && (
                                <div className="text-xs">
                                  <strong>Changes:</strong>
                                  <pre className="text-xs bg-muted p-1 rounded mt-1 overflow-auto max-h-20">
                                    {JSON.stringify(log.details.changes.new, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.details?.error && (
                                <div className="text-xs text-red-600">
                                  <strong>Error:</strong> {log.details.error}
                                </div>
                              )}
                              {log.details?.metadata && Object.keys(log.details.metadata).length > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  <strong>Metadata:</strong> {JSON.stringify(log.details.metadata)}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {log.ipAddress || 'N/A'}
                          </TableCell>
                          <TableCell>
                            {log.details?.success !== false ? (
                              <Badge className="bg-green-100 text-green-800 text-xs">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Success
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800 text-xs">
                                <XCircle className="w-3 h-3 mr-1" />
                                Failed
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Pagination */}
          {activityData?.data?.pagination && activityData.data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Page {activityData.data.pagination.currentPage} of {activityData.data.pagination.totalPages}
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!activityData.data.pagination.hasPrevPage}
                  onClick={() => setActivityFilters(prev => ({ ...prev, page: prev.page - 1 }))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!activityData.data.pagination.hasNextPage}
                  onClick={() => setActivityFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* System Health Tab */}
        <TabsContent value="system" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">System Health & Monitoring</h3>
              <p className="text-muted-foreground">Monitor system performance and health metrics</p>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline">
                <Database className="w-4 h-4 mr-2" />
                Database Tools
              </Button>
              <Button variant="outline">
                <Server className="w-4 h-4 mr-2" />
                System Logs
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Server className="w-4 h-4 mr-2" />
                  Server Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>CPU Usage</span>
                    <Badge variant="outline">45%</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Memory Usage</span>
                    <Badge variant="outline">68%</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Disk Usage</span>
                    <Badge variant="outline">32%</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="w-4 h-4 mr-2" />
                  Database Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Connection Pool</span>
                    <Badge className="bg-green-100 text-green-800">Healthy</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Query Performance</span>
                    <Badge className="bg-green-100 text-green-800">Good</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Index Health</span>
                    <Badge className="bg-green-100 text-green-800">Optimal</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="w-4 h-4 mr-2" />
                  System Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Active Sessions</span>
                    <Badge variant="outline">23</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>API Requests/min</span>
                    <Badge variant="outline">156</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Error Rate</span>
                    <Badge className="bg-green-100 text-green-800">0.02%</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>System Maintenance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-4">
                  <h4 className="font-semibold">Backup & Recovery</h4>
                  <div className="space-y-2">
                    <Button className="w-full" variant="outline">
                      <Download className="w-4 h-4 mr-2" />
                      Create Full Backup
                    </Button>
                    <Button className="w-full" variant="outline">
                      <Upload className="w-4 h-4 mr-2" />
                      Restore from Backup
                    </Button>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="font-semibold">System Maintenance</h4>
                  <div className="space-y-2">
                    <Button className="w-full" variant="outline">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Restart Services
                    </Button>
                    <Button className="w-full" variant="outline">
                      <Database className="w-4 h-4 mr-2" />
                      Optimize Database
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Company Dialog */}
      <Dialog open={isCompanyDialogOpen} onOpenChange={setIsCompanyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCompany ? `Edit Company: ${editingCompany.name}` : 'Create New Company'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={companyForm.handleSubmit(onCompanySubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Company Name</Label>
              <Input
                id="name"
                {...companyForm.register("name")}
                placeholder="Enter company name"
              />
              {companyForm.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {companyForm.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Company Code</Label>
              <Input
                id="code"
                {...companyForm.register("code")}
                placeholder="e.g., ACME"
                className="uppercase"
              />
              {companyForm.formState.errors.code && (
                <p className="text-sm text-destructive">
                  {companyForm.formState.errors.code.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                {...companyForm.register("description")}
                placeholder="Enter company description"
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsCompanyDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createCompanyMutation.isPending || updateCompanyMutation.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                {(createCompanyMutation.isPending || updateCompanyMutation.isPending) 
                  ? 'Saving...' 
                  : editingCompany ? 'Update Company' : 'Create Company'
                }
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Global User Dialog */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingUser ? `Edit User: ${editingUser.username}` : 'Create New Global User'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={userForm.handleSubmit(onUserSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  {...userForm.register("firstName")}
                  placeholder="Enter first name"
                />
                {userForm.formState.errors.firstName && (
                  <p className="text-sm text-destructive">
                    {userForm.formState.errors.firstName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  {...userForm.register("lastName")}
                  placeholder="Enter last name"
                />
                {userForm.formState.errors.lastName && (
                  <p className="text-sm text-destructive">
                    {userForm.formState.errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                {...userForm.register("username")}
                placeholder="Enter username"
              />
              {userForm.formState.errors.username && (
                <p className="text-sm text-destructive">
                  {userForm.formState.errors.username.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...userForm.register("email")}
                placeholder="user@example.com"
              />
              {userForm.formState.errors.email && (
                <p className="text-sm text-destructive">
                  {userForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Password {editingUser && "(leave empty to keep current)"}
              </Label>
              <Input
                id="password"
                type="password"
                {...userForm.register("password")}
                placeholder="Enter password"
              />
              {userForm.formState.errors.password && (
                <p className="text-sm text-destructive">
                  {userForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="globalRole">Global Role</Label>
              <Select
                value={userForm.watch("globalRole")}
                onValueChange={(value) => userForm.setValue("globalRole", value as GlobalRole)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select global role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Standard User</SelectItem>
                  <SelectItem value="global_administrator">Global Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end space-x-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsUserDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createGlobalUserMutation.isPending || updateGlobalUserMutation.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                {(createGlobalUserMutation.isPending || updateGlobalUserMutation.isPending) 
                  ? 'Saving...' 
                  : editingUser ? 'Update User' : 'Create User'
                }
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
} 
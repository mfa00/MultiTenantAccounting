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
  description: string | null;
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
  password: z.string().min(6, "Password must be at least 6 characters"),
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
    queryKey: ['/api/admin/system-stats'],
    queryFn: async () => {
      // Mock data for now - implement real endpoints
      return {
        totalCompanies: 15,
        activeCompanies: 13,
        totalUsers: 45,
        activeUsers: 38,
        totalTransactions: 1247,
        storageUsed: "2.3 GB",
        systemUptime: "15 days, 3 hours",
        lastBackup: "2024-01-20T02:00:00Z",
      };
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

  const { data: activityLogs = [], isLoading: logsLoading } = useQuery<ActivityLog[]>({
    queryKey: ['/api/global-admin/activity'],
    queryFn: async () => {
      const response = await fetch('/api/global-admin/activity');
      if (!response.ok) {
        throw new Error('Failed to fetch activity logs');
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
    mutationFn: (data: CompanyForm) => apiRequest('POST', '/api/admin/companies', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/system-stats'] });
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
      apiRequest('PUT', `/api/admin/companies/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/companies'] });
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
    mutationFn: (id: number) => apiRequest('DELETE', `/api/admin/companies/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/system-stats'] });
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
    mutationFn: (data: GlobalUserForm) => apiRequest('POST', '/api/admin/global-users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/global-users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/system-stats'] });
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
      apiRequest('PUT', `/api/admin/global-users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/global-users'] });
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
      apiRequest('PUT', `/api/admin/global-users/${id}/status`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/global-users'] });
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
      apiRequest('PUT', `/api/admin/companies/${id}/status`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/companies'] });
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

  // Helper functions
  const handleEditCompany = (company: Company) => {
    setEditingCompany(company);
    companyForm.setValue("name", company.name);
    companyForm.setValue("code", company.code);
    companyForm.setValue("description", company.description || "");
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
    if (editingCompany) {
      updateCompanyMutation.mutate({ id: editingCompany.id, data });
    } else {
      createCompanyMutation.mutate(data);
    }
  };

  const onUserSubmit = (data: GlobalUserForm) => {
    if (editingUser) {
      const updateData = { ...data };
      if (!data.password) delete updateData.password; // Don't update password if empty
      updateGlobalUserMutation.mutate({ id: editingUser.id, data: updateData });
    } else {
      createGlobalUserMutation.mutate(data);
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
                          {company.description && (
                            <div className="text-sm text-muted-foreground">
                              {company.description}
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
                          >
                            {user.isActive ? (
                              <XCircle className="w-4 h-4" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                          </Button>
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
            <Button variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activityLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{formatDate(log.timestamp)}</TableCell>
                      <TableCell className="font-medium">{log.userName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.action}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{log.resource}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {log.details}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.ipAddress}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
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
              <Button type="submit">
                <Save className="w-4 h-4 mr-2" />
                {editingCompany ? 'Update Company' : 'Create Company'}
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
                {...userForm.register("password", { 
                  required: !editingUser ? "Password is required" : false 
                })}
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
              <Button type="submit">
                <Save className="w-4 h-4 mr-2" />
                {editingUser ? 'Update User' : 'Create User'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
} 
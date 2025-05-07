import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { 
  Building2, 
  UserPlus, 
  Users, 
  Settings, 
  Tags, 
  Database, 
  Key, 
  Shield, 
  ChevronRight, 
  Home
} from "lucide-react";

interface SideMenuProps {
  activeItem: string;
  onSelectItem: (item: string) => void;
}

export function SideMenu({ activeItem, onSelectItem }: SideMenuProps) {
  const menuItems = [
    {
      id: "companies",
      label: "Empresas",
      icon: <Building2 className="h-5 w-5 mr-2" />,
      description: "Gestión de empresas"
    },
    {
      id: "users",
      label: "Usuarios",
      icon: <Users className="h-5 w-5 mr-2" />,
      description: "Gestión de usuarios"
    },
    {
      id: "credentials",
      label: "Credenciales",
      icon: <Key className="h-5 w-5 mr-2" />,
      description: "Gestión de credenciales"
    },
    {
      id: "tags",
      label: "Etiquetas",
      icon: <Tags className="h-5 w-5 mr-2" />,
      description: "Gestión de etiquetas"
    },
    {
      id: "permissions",
      label: "Permisos",
      icon: <Shield className="h-5 w-5 mr-2" />,
      description: "Gestión de permisos"
    },
    {
      id: "sync",
      label: "Sincronización",
      icon: <Database className="h-5 w-5 mr-2" />,
      description: "Sincronización con BD externa"
    },
    {
      id: "settings",
      label: "Configuración",
      icon: <Settings className="h-5 w-5 mr-2" />,
      description: "Configuración general"
    }
  ];

  return (
    <div className="w-full border-r border-gray-200 h-full bg-gray-50">
      <div className="py-4">
        <Link href="/">
          <div className="flex items-center px-6 py-2 text-sm font-medium text-slate-600 hover:text-primary cursor-pointer">
            <Home className="h-4 w-4 mr-2" />
            <span>Inicio</span>
          </div>
        </Link>
        
        <div className="px-6 py-3">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Administración
          </h3>
        </div>
        
        <nav className="space-y-1 px-2">
          {menuItems.map((item) => (
            <div
              key={item.id}
              className={cn(
                "flex items-center px-4 py-3 text-sm rounded-md cursor-pointer transition-colors",
                activeItem === item.id
                  ? "bg-primary text-white"
                  : "text-gray-700 hover:bg-gray-100"
              )}
              onClick={() => onSelectItem(item.id)}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center">
                  {item.icon}
                  <div>
                    <div className="font-medium">{item.label}</div>
                    <div className={cn(
                      "text-xs",
                      activeItem === item.id ? "text-gray-100" : "text-gray-500"
                    )}>
                      {item.description}
                    </div>
                  </div>
                </div>
                <ChevronRight className={cn(
                  "h-4 w-4",
                  activeItem === item.id ? "text-white" : "text-gray-400"
                )} />
              </div>
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}
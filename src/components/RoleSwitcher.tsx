import { useAuth } from '@/contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserRole } from '@/types';

export default function RoleSwitcher() {
  const { user, switchRole } = useAuth();

  return (
    <Select value={user?.role} onValueChange={(v) => switchRole(v as UserRole)}>
      <SelectTrigger className="w-[160px] h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="super_admin">Super Admin</SelectItem>
        <SelectItem value="location_admin">Location Admin</SelectItem>
        <SelectItem value="employee">Employee</SelectItem>
        <SelectItem value="third_party">Third-Party Op.</SelectItem>
      </SelectContent>
    </Select>
  );
}

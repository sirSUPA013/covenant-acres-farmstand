import React, { useState, useEffect } from 'react';
import {
  UserPermissions,
  UserRole,
  PageKey,
  PAGE_INFO,
  DEFAULT_PERMISSIONS,
  getUserRole,
  parsePermissions,
} from '../../shared/permissions';

interface AdminUser {
  id: string;
  name: string;
  is_active: number;
  is_developer: number;
  is_owner: number;
  permissions: string | null;
  last_login: string | null;
  created_at: string;
}

interface CurrentUser {
  id: string;
  name: string;
  role: UserRole;
  isDeveloper: boolean;
  isOwner: boolean;
  permissions: UserPermissions;
}

function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formPin, setFormPin] = useState('');
  const [formRole, setFormRole] = useState<'owner' | 'admin'>('admin');
  const [formPermissions, setFormPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [usersData, userData] = await Promise.all([
        window.api.getAdminUsers(),
        window.api.getCurrentUser(),
      ]);
      setUsers(usersData as AdminUser[]);
      setCurrentUser(userData as CurrentUser);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
    setLoading(false);
  }

  function getRoleBadge(user: AdminUser): { label: string; className: string } {
    if (user.is_developer) return { label: 'Developer', className: 'badge-developer' };
    if (user.is_owner) return { label: 'Owner', className: 'badge-owner' };
    return { label: 'Admin', className: 'badge-admin' };
  }

  function canEditUser(user: AdminUser): boolean {
    if (!currentUser) return false;
    // Developers can edit anyone
    if (currentUser.isDeveloper) return true;
    // Owners can edit admins and themselves
    if (currentUser.isOwner) {
      return !user.is_developer && !user.is_owner || user.id === currentUser.id;
    }
    // Admins can only edit themselves
    return user.id === currentUser.id;
  }

  function canDeleteUser(user: AdminUser): boolean {
    if (!currentUser) return false;
    // Can't delete yourself
    if (user.id === currentUser.id) return false;
    // Can't delete developers
    if (user.is_developer) return false;
    // Only developers can delete owners
    if (user.is_owner) return currentUser.isDeveloper;
    // Developers and owners can delete admins
    return currentUser.isDeveloper || currentUser.isOwner;
  }

  function canCreateUsers(): boolean {
    return currentUser?.isDeveloper || currentUser?.isOwner || false;
  }

  function canCreateOwners(): boolean {
    return currentUser?.isDeveloper || false;
  }

  function openAddModal() {
    setFormName('');
    setFormPin('');
    setFormRole('admin');
    setFormPermissions(DEFAULT_PERMISSIONS);
    setShowAddModal(true);
  }

  function openEditModal(user: AdminUser) {
    setFormName(user.name);
    setFormPin('');
    setFormRole(user.is_owner ? 'owner' : 'admin');
    const role = getUserRole(user.is_developer === 1, user.is_owner === 1);
    setFormPermissions(parsePermissions(user.permissions, role));
    setEditingUser(user);
  }

  function closeModal() {
    setShowAddModal(false);
    setEditingUser(null);
    setFormName('');
    setFormPin('');
    setFormRole('admin');
    setFormPermissions(DEFAULT_PERMISSIONS);
  }

  async function handleSave() {
    if (!formName.trim()) {
      alert('Please enter a name');
      return;
    }

    if (showAddModal && !formPin.trim()) {
      alert('Please enter a PIN');
      return;
    }

    try {
      if (showAddModal) {
        const result = await window.api.createAdminUser({
          name: formName.trim(),
          pin: formPin,
          role: formRole,
          permissions: formRole === 'admin' ? formPermissions : undefined,
        });
        if (!result.success) {
          alert(result.error || 'Failed to create user');
          return;
        }
      } else if (editingUser) {
        const updates: Record<string, unknown> = { name: formName.trim() };
        if (formPin.trim()) {
          updates.pin = formPin;
        }
        // Only include permissions for admins (owners get full permissions)
        if (!editingUser.is_owner && !editingUser.is_developer) {
          updates.permissions = formPermissions;
        }
        // Only developers can change owner status
        if (currentUser?.isDeveloper && !editingUser.is_developer) {
          updates.isOwner = formRole === 'owner';
        }

        const result = await window.api.updateAdminUser(editingUser.id, updates);
        if (!result.success) {
          alert(result.error || 'Failed to update user');
          return;
        }
      }

      closeModal();
      loadData();
    } catch (error) {
      console.error('Save failed:', error);
      alert('An error occurred');
    }
  }

  async function handleToggleActive(user: AdminUser) {
    try {
      const result = await window.api.updateAdminUser(user.id, {
        isActive: !user.is_active,
      });
      if (result.success) {
        loadData();
      } else {
        alert(result.error || 'Failed to update user');
      }
    } catch (error) {
      console.error('Toggle failed:', error);
    }
  }

  async function handleDelete(user: AdminUser) {
    if (!confirm(`Are you sure you want to delete "${user.name}"?`)) return;

    try {
      const result = await window.api.deleteAdminUser(user.id);
      if (result.success) {
        loadData();
      } else {
        alert(result.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Delete failed:', error);
    }
  }

  function updatePermission(page: PageKey, level: 'none' | 'read' | 'write') {
    setFormPermissions((prev) => ({ ...prev, [page]: level }));
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  }

  const pages = Object.keys(PAGE_INFO) as PageKey[];

  return (
    <div className="users-page">
      <div className="page-header">
        <h1 className="page-title">Users</h1>
        {canCreateUsers() && (
          <button className="btn btn-primary" onClick={openAddModal}>
            Add User
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading">Loading users...</div>
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const badge = getRoleBadge(user);
                return (
                  <tr key={user.id} className={!user.is_active ? 'inactive-row' : ''}>
                    <td>
                      <strong>{user.name}</strong>
                      {user.id === currentUser?.id && (
                        <span className="badge badge-you">You</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${badge.className}`}>{badge.label}</span>
                    </td>
                    <td>
                      <span className={`status-badge ${user.is_active ? 'status-active' : 'status-inactive'}`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>{formatDate(user.last_login)}</td>
                    <td>
                      <div className="action-buttons">
                        {canEditUser(user) && (
                          <button
                            className="btn btn-small"
                            onClick={() => openEditModal(user)}
                          >
                            Edit
                          </button>
                        )}
                        {canEditUser(user) && user.id !== currentUser?.id && (
                          <button
                            className="btn btn-small"
                            onClick={() => handleToggleActive(user)}
                          >
                            {user.is_active ? 'Disable' : 'Enable'}
                          </button>
                        )}
                        {canDeleteUser(user) && (
                          <button
                            className="btn btn-small btn-danger"
                            onClick={() => handleDelete(user)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingUser) && (
        <div className="modal-overlay">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{showAddModal ? 'Add User' : 'Edit User'}</h2>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Enter name"
                />
              </div>

              <div className="form-group">
                <label>{showAddModal ? 'PIN' : 'New PIN (leave blank to keep current)'}</label>
                <input
                  type="password"
                  className="form-input"
                  value={formPin}
                  onChange={(e) => setFormPin(e.target.value)}
                  placeholder={showAddModal ? 'Enter PIN' : 'Enter new PIN (optional)'}
                />
              </div>

              {/* Role selection - only for non-developers */}
              {(!editingUser || !editingUser.is_developer) && (
                <div className="form-group">
                  <label>Role</label>
                  <select
                    className="form-select"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as 'owner' | 'admin')}
                    disabled={!canCreateOwners() && formRole !== 'admin'}
                  >
                    <option value="admin">Admin</option>
                    {canCreateOwners() && <option value="owner">Owner</option>}
                  </select>
                </div>
              )}

              {/* Permissions - only for admins */}
              {formRole === 'admin' && (!editingUser || !editingUser.is_owner) && (
                <div className="form-group">
                  <label>Page Permissions</label>
                  <div className="permissions-grid">
                    {pages.map((page) => (
                      <div key={page} className="permission-row">
                        <span className="permission-label">{PAGE_INFO[page].label}</span>
                        <div className="permission-buttons">
                          <button
                            type="button"
                            className={`perm-btn ${formPermissions[page] === 'none' ? 'active' : ''}`}
                            onClick={() => updatePermission(page, 'none')}
                          >
                            None
                          </button>
                          <button
                            type="button"
                            className={`perm-btn ${formPermissions[page] === 'read' ? 'active' : ''}`}
                            onClick={() => updatePermission(page, 'read')}
                          >
                            Read
                          </button>
                          <button
                            type="button"
                            className={`perm-btn ${formPermissions[page] === 'write' ? 'active' : ''}`}
                            onClick={() => updatePermission(page, 'write')}
                          >
                            Write
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                {showAddModal ? 'Create User' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UsersPage;

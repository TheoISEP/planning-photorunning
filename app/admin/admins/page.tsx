'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Admin {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  actif: boolean;
}

export default function AdminsListPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admins');
      const data = await res.json();
      setAdmins(data.admins || []);
    } catch (error) {
      console.error('Erreur chargement admins:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActif = async (id: string, currentActif: boolean) => {
    try {
      const res = await fetch(`/api/admins/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actif: !currentActif,
        }),
      });

      if (res.ok) {
        setAdmins((prev) =>
          prev.map((a) => (a.id === id ? { ...a, actif: !currentActif } : a))
        );
        toast.success(`Admin ${!currentActif ? 'activé' : 'désactivé'} avec succès`);
      } else {
        toast.error('Erreur lors de la mise à jour');
      }
    } catch (error) {
      console.error('Erreur toggle actif:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  // Filtrage et recherche
  const filteredAdmins = admins.filter((a) => {
    const query = searchQuery.toLowerCase();
    return (
      a.nom.toLowerCase().includes(query) ||
      a.prenom.toLowerCase().includes(query) ||
      a.email.toLowerCase().includes(query)
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredAdmins.length / itemsPerPage);
  const paginatedAdmins = filteredAdmins.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-gray-600 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admins</h1>
            <p className="text-sm text-gray-600 mt-1">
              Gérez les comptes administrateurs
            </p>
          </div>
          <Link href="/admin/admins/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Créer un admin
            </Button>
          </Link>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Search */}
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Rechercher par nom, prénom ou email..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10"
            />
          </div>

          {/* Pagination */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-600">
              Page {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="bg-white rounded-lg border border-gray-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Prénom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedAdmins.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                    Aucun admin trouvé
                  </TableCell>
                </TableRow>
              ) : (
                paginatedAdmins.map((admin) => (
                  <TableRow
                    key={admin.id}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => router.push(`/admin/admins/${admin.id}/profile`)}
                  >
                    <TableCell className="font-medium">{admin.nom}</TableCell>
                    <TableCell>{admin.prenom}</TableCell>
                    <TableCell className="text-gray-600">{admin.email}</TableCell>
                    <TableCell className="text-gray-600">{admin.telephone}</TableCell>
                    <TableCell>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleActif(admin.id, admin.actif);
                        }}
                        className="cursor-pointer"
                      >
                        {admin.actif ? (
                          <Badge className="bg-gray-100 text-gray-800 border-gray-300">
                            Actif
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-800 border-gray-300">
                            Inactif
                          </Badge>
                        )}
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

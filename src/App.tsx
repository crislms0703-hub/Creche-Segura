import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Printer, Trash2, UserPlus, Phone, Users, GraduationCap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Student, Guardian, CLASSES } from './types';
import { db } from './firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  getDocFromServer
} from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export default function App() {
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState<string>('todas');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);
  const [isDeleteClassModalOpen, setIsDeleteClassModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Firestore Connection Test
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Erro de conexão com Firebase. Verifique a configuração.");
        }
      }
    }
    testConnection();
  }, []);

  // Firestore Listener
  useEffect(() => {
    const q = query(collection(db, 'students'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const studentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Student[];
      setStudents(studentsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'students');
    });

    return () => unsubscribe();
  }, []);

  function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    toast.error(`Erro no banco de dados: ${errInfo.error}`);
  }

  // Form State
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentClass, setNewStudentClass] = useState('');
  const [guardians, setGuardians] = useState<Omit<Guardian, 'id'>[]>([{ name: '', phone: '', relationship: '' }]);

  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const nameMatch = student.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const guardianMatch = student.guardians?.some(g => g.name?.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesSearch = nameMatch || guardianMatch;
      const matchesClass = filterClass === 'todas' || student.className === filterClass;
      return matchesSearch && matchesClass;
    });
  }, [students, searchTerm, filterClass]);

  const handleAddGuardian = () => {
    setGuardians([...guardians, { name: '', phone: '', relationship: '' }]);
  };

  const handleRemoveGuardian = (index: number) => {
    setGuardians(guardians.filter((_, i) => i !== index));
  };

  const handleGuardianChange = (index: number, field: keyof Omit<Guardian, 'id'>, value: string) => {
    const updated = [...guardians];
    updated[index][field] = value;
    setGuardians(updated);
  };

  const handleSaveStudent = async () => {
    if (!newStudentName || !newStudentClass || guardians.some(g => !g.name || !g.phone || !g.relationship)) {
      toast.error('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    try {
      if (editingStudent) {
        const studentRef = doc(db, 'students', editingStudent.id);
        await updateDoc(studentRef, {
          name: newStudentName,
          className: newStudentClass,
          guardians: guardians.map(g => ('id' in g ? g : { ...g, id: crypto.randomUUID() }))
        });
        toast.success('Dados do aluno atualizados!');
      } else {
        await addDoc(collection(db, 'students'), {
          name: newStudentName,
          className: newStudentClass,
          guardians: guardians.map(g => ({ ...g, id: crypto.randomUUID() })),
          createdAt: Date.now(),
        });
        toast.success('Aluno cadastrado com sucesso!');
      }
      resetForm();
      setIsAddModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, editingStudent ? OperationType.UPDATE : OperationType.CREATE, 'students');
    }
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setNewStudentName(student.name);
    setNewStudentClass(student.className);
    setGuardians(student.guardians);
    setIsAddModalOpen(true);
  };

  const resetForm = () => {
    setNewStudentName('');
    setNewStudentClass('');
    setGuardians([{ name: '', phone: '', relationship: '' }]);
    setEditingStudent(null);
  };

  const handleDeleteStudent = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'students', id));
      setStudentToDelete(null);
      toast.success('Aluno removido com sucesso.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `students/${id}`);
    }
  };

  const handleDeleteClass = async () => {
    if (filterClass === 'todas') return;
    try {
      const studentsToDelete = students.filter(s => s.className === filterClass);
      for (const s of studentsToDelete) {
        await deleteDoc(doc(db, 'students', s.id));
      }
      setIsDeleteClassModalOpen(false);
      toast.success(`Todos os alunos da turma ${filterClass} foram removidos.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'students/bulk');
    }
  };

  const handlePrint = () => {
    window.focus();
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-200 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-200 p-4 md:p-8 font-sans transition-colors duration-300">
      <Toaster />
      
      <div className="no-print">
        {/* Header */}
        <header className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <GraduationCap className="text-blue-600" />
              Creche Segura
            </h1>
            <p className="text-slate-500">Gestão de retirada de alunos</p>
          </div>
          
          <div className="flex items-center gap-3">
            <Dialog open={isAddModalOpen} onOpenChange={(open) => {
              setIsAddModalOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Aluno
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingStudent ? 'Editar Aluno' : 'Cadastrar Novo Aluno'}</DialogTitle>
                  <DialogDescription>
                    {editingStudent 
                      ? 'Altere os dados do aluno ou dos responsáveis autorizados.' 
                      : 'Insira os dados do aluno e dos responsáveis autorizados para retirada.'}
                  </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-6 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nome do Aluno</Label>
                    <Input 
                      id="name" 
                      placeholder="Nome completo" 
                      value={newStudentName}
                      onChange={(e) => setNewStudentName(e.target.value)}
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="class">Turma</Label>
                    <Select value={newStudentClass} onValueChange={setNewStudentClass}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a turma" />
                      </SelectTrigger>
                      <SelectContent>
                        {CLASSES.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">Responsáveis Autorizados</Label>
                      <Button variant="outline" size="sm" onClick={handleAddGuardian}>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Adicionar
                      </Button>
                    </div>
                    
                    {guardians.map((guardian, index) => (
                      <Card key={index} className="bg-slate-50/50 border-dashed">
                        <CardContent className="pt-4 space-y-3">
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1 space-y-3">
                              <Input 
                                placeholder="Nome do Responsável" 
                                value={guardian.name}
                                onChange={(e) => handleGuardianChange(index, 'name', e.target.value)}
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <Input 
                                  placeholder="Telefone" 
                                  value={guardian.phone}
                                  onChange={(e) => handleGuardianChange(index, 'phone', e.target.value)}
                                />
                                <Input 
                                  placeholder="Parentesco (Ex: Pai)" 
                                  value={guardian.relationship}
                                  onChange={(e) => handleGuardianChange(index, 'relationship', e.target.value)}
                                />
                              </div>
                            </div>
                            {guardians.length > 1 && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => handleRemoveGuardian(index)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setIsAddModalOpen(false);
                    resetForm();
                  }}>Cancelar</Button>
                  <Button onClick={handleSaveStudent}>
                    {editingStudent ? 'Salvar Alterações' : 'Salvar Aluno'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            <Button variant="outline" onClick={handlePrint} disabled={filteredStudents.length === 0} className="bg-slate-100 border-slate-300">
              <Printer className="w-4 h-4 mr-2" />
              Imprimir Lista
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-6xl mx-auto space-y-6">
          {/* Filters */}
          <Card className="bg-slate-100 border-slate-300 shadow-sm">
            <CardContent className="p-4 flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">
                  Buscar Aluno ou Responsável
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input 
                    placeholder="Ex: João Silva ou Maria Oliveira..." 
                    className="pl-10 bg-white border-slate-200 focus:ring-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="w-full md:w-72 space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">
                  Filtrar por Turma
                </Label>
                <Select value={filterClass} onValueChange={setFilterClass}>
                  <SelectTrigger className="bg-white border-slate-200">
                    <SelectValue placeholder="Selecione uma turma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as Turmas</SelectItem>
                    {CLASSES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* List */}
          <div className="bg-slate-100 rounded-xl shadow-md border border-slate-300 overflow-hidden">
            <div className="p-6 border-b border-slate-300 flex items-center justify-between bg-slate-200/50">
              <h2 className="text-lg font-semibold text-slate-900">
                {filterClass === 'todas' ? 'Todos os Alunos' : `Alunos - ${filterClass}`}
                <Badge variant="secondary" className="ml-2 bg-slate-200 text-slate-600 border-none">
                  {filteredStudents.length}
                </Badge>
              </h2>
              {filterClass !== 'todas' && filteredStudents.length > 0 && (
                <Dialog open={isDeleteClassModalOpen} onOpenChange={setIsDeleteClassModalOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50 font-medium">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Excluir Turma Toda
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Excluir Turma Completa</DialogTitle>
                      <DialogDescription>
                        Você tem certeza que deseja excluir <strong>todos os {filteredStudents.length} alunos</strong> da turma <strong>{filterClass}</strong>? Esta ação não pode ser desfeita.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                      <Button variant="outline" onClick={() => setIsDeleteClassModalOpen(false)}>Não, Cancelar</Button>
                      <Button variant="destructive" onClick={handleDeleteClass}>Sim, Excluir Tudo</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-300/70">
                  <TableRow className="border-slate-300">
                    <TableHead className="w-[250px] text-slate-800 font-bold">Aluno</TableHead>
                    <TableHead className="text-slate-800 font-bold">Turma</TableHead>
                    <TableHead className="text-slate-800 font-bold">Responsáveis Autorizados</TableHead>
                    <TableHead className="text-right text-slate-800 font-bold">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence mode="popLayout">
                    {filteredStudents.length > 0 ? (
                      filteredStudents.map((student) => (
                        <motion.tr
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          key={student.id}
                          className="group hover:bg-slate-200 transition-colors border-slate-300"
                        >
                          <TableCell className="font-medium text-slate-900">
                            {student.name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-normal border-slate-300 bg-white">
                              {student.className}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-2 py-1">
                              {student.guardians?.map((g) => (
                                <div key={g.id} className="text-sm flex flex-col">
                                  <span className="font-medium text-slate-700">{g.name}</span>
                                  <div className="flex items-center gap-3 text-slate-500 text-xs mt-0.5">
                                    <span className="flex items-center gap-1">
                                      <Phone className="w-3 h-3" /> {g.phone}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Users className="w-3 h-3" /> {g.relationship}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-slate-500 hover:text-blue-600 hover:bg-blue-50 h-8 px-2 text-xs font-medium"
                                onClick={() => handleEditStudent(student)}
                              >
                                Editar
                              </Button>
                              <Dialog open={studentToDelete === student.id} onOpenChange={(open) => !open && setStudentToDelete(null)}>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="text-slate-500 hover:text-red-500 hover:bg-red-50"
                                    onClick={() => setStudentToDelete(student.id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Confirmar Exclusão</DialogTitle>
                                    <DialogDescription>
                                      Tem certeza que deseja excluir o aluno <strong>{student.name}</strong>?
                                    </DialogDescription>
                                  </DialogHeader>
                                  <DialogFooter className="gap-2 sm:gap-0">
                                    <Button variant="outline" onClick={() => setStudentToDelete(null)}>Não</Button>
                                    <Button variant="destructive" onClick={() => handleDeleteStudent(student.id)}>Sim, Excluir</Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </TableCell>
                        </motion.tr>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="h-32 text-center text-slate-400">
                          Nenhum aluno encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          </div>
        </main>
      </div>

      {/* Print View (Hidden on Screen) */}
      <div className="hidden print-only p-4">
        <div className="text-center mb-8 border-b-4 border-black pb-6">
          <h1 className="text-3xl font-black uppercase tracking-widest">Creche Segura</h1>
          <h2 className="text-xl font-bold mt-2">LISTA DE AUTORIZAÇÃO PARA RETIRADA</h2>
          <div className="flex justify-center gap-8 mt-4 text-lg">
            <p><strong>Turma:</strong> {filterClass === 'todas' ? 'Todas as Turmas' : filterClass}</p>
            <p><strong>Data:</strong> {new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>

        <table className="w-full border-2 border-black">
          <thead>
            <tr className="bg-gray-200">
              <th className="border-2 border-black p-3 text-left font-black uppercase">Aluno</th>
              <th className="border-2 border-black p-3 text-left font-black uppercase">Turma</th>
              <th className="border-2 border-black p-3 text-left font-black uppercase">Responsáveis Autorizados / Contatos</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map(student => (
              <tr key={student.id} className="break-inside-avoid">
                <td className="border-2 border-black p-3 font-bold text-lg">{student.name}</td>
                <td className="border-2 border-black p-3">{student.className}</td>
                <td className="border-2 border-black p-3">
                  <div className="space-y-2">
                    {student.guardians?.map(g => (
                      <div key={g.id} className="border-b border-gray-300 last:border-0 pb-1">
                        <span className="font-bold">{g.name}</span>
                        <span className="mx-2">|</span>
                        <span>{g.phone}</span>
                        <span className="mx-2">|</span>
                        <span className="italic text-sm">{g.relationship}</span>
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <div className="mt-16 grid grid-cols-2 gap-20 px-10">
          <div className="text-center">
            <div className="border-t-2 border-black pt-2">
              <p className="font-bold uppercase text-sm">Assinatura da Direção</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t-2 border-black pt-2">
              <p className="font-bold uppercase text-sm">Carimbo da Instituição</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

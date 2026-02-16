import { useState, useMemo } from "react";
import { useTemplates } from "@/hooks/useTemplates";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Sparkles, Pencil, Trash2, FileText, Send } from "lucide-react";
import TemplateEditorModal from "@/components/templates/TemplateEditorModal";
import AITemplateGenerator from "@/components/templates/AITemplateGenerator";
import ComposeModal from "@/components/ComposeModal";
import { TEMPLATE_CATEGORIES, getCategoryStyle, type EmailTemplate } from "@/components/templates/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Templates() {
  const { templates, loading, createTemplate, updateTemplate, deleteTemplate, trackUsage } = useTemplates();
  const [categoryTab, setCategoryTab] = useState("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [generatedData, setGeneratedData] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");

  const filtered = useMemo(() => {
    if (categoryTab === "all") return templates;
    return templates.filter((t) => t.category === categoryTab);
  }, [templates, categoryTab]);

  const handleUseTemplate = (t: EmailTemplate) => {
    trackUsage(t.id);
    setComposeSubject(t.subject_template);
    setComposeBody(t.body_template);
    setComposeOpen(true);
  };

  const handleEdit = (t: EmailTemplate) => {
    setEditingTemplate(t);
    setEditorOpen(true);
  };

  const handleSave = (data: { name: string; category: string; subject_template: string; body_template: string; tone: string }) => {
    if (editingTemplate) {
      updateTemplate(editingTemplate.id, data);
    } else {
      createTemplate(data);
    }
    setEditingTemplate(null);
  };

  const handleAIGenerated = (data: any) => {
    setGeneratedData(data);
    setEditingTemplate(null);
    setEditorOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Email Templates</h1>
          <Badge variant="secondary" className="text-xs">{templates.length} templates</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setGeneratorOpen(true)}>
            <Sparkles className="h-4 w-4" /> AI Generate
          </Button>
          <Button onClick={() => { setEditingTemplate(null); setGeneratedData(null); setEditorOpen(true); }}>
            <Plus className="h-4 w-4" /> New Template
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <Tabs value={categoryTab} onValueChange={setCategoryTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          {TEMPLATE_CATEGORIES.map((c) => (
            <TabsTrigger key={c.value} value={c.value}>{c.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No templates yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Create one or let AI generate templates for you</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((t) => (
            <Card key={t.id} className="group hover:border-primary/30 transition-colors">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-foreground text-sm">{t.name}</h3>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(t)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteConfirm(t.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className={`text-[10px] h-5 ${getCategoryStyle(t.category)}`}>{t.category}</Badge>
                  <Badge variant="outline" className="text-[10px] h-5">{t.tone}</Badge>
                </div>
                <p className="text-xs text-muted-foreground font-medium">{t.subject_template}</p>
                <p className="text-xs text-muted-foreground/70 line-clamp-2">{t.body_template}</p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-muted-foreground">
                    Used {t.use_count} time{t.use_count !== 1 ? "s" : ""}
                    {t.last_used_at && ` · Last ${new Date(t.last_used_at).toLocaleDateString()}`}
                  </span>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleUseTemplate(t)}>
                    <Send className="h-3 w-3" /> Use
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modals */}
      <TemplateEditorModal
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setEditingTemplate(null); setGeneratedData(null); }}
        onSave={handleSave}
        template={editingTemplate}
        initialData={generatedData}
      />

      <AITemplateGenerator
        open={generatorOpen}
        onClose={() => setGeneratorOpen(false)}
        onGenerated={handleAIGenerated}
      />

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteConfirm) deleteTemplate(deleteConfirm); setDeleteConfirm(null); }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        initialSubject={composeSubject}
        initialBody={composeBody}
      />
    </div>
  );
}

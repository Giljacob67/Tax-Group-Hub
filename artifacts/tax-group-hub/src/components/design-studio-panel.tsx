import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Image as ImageIcon, Palette, Grid3X3,
  Loader2, Download, ExternalLink, X, Sparkles
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGenerateImage, useGetCanvaLink, useGetImageGallery } from "@workspace/api-client-react";
import type { GalleryImage } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

const CANVA_TEMPLATES = [
  { id: "post-linkedin", label: "Post LinkedIn", icon: "📝", desc: "Post profissional" },
  { id: "presentation", label: "Apresentação", icon: "📊", desc: "Pitch & slides" },
  { id: "infografico", label: "Infográfico", icon: "📈", desc: "Dados visuais" },
  { id: "email-header", label: "Email Header", icon: "✉️", desc: "Banner de email" },
  { id: "one-pager", label: "One-Pager", icon: "📄", desc: "Resumo executivo" },
  { id: "banner", label: "Banner", icon: "🖼️", desc: "Capa / banner" },
];

export function DesignStudioPanel({
  agentId,
  agentName,
  onClose
}: {
  agentId: string;
  agentName: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageStyle, setImageStyle] = useState("professional");
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const generateMutation = useGenerateImage();
  const canvaMutation = useGetCanvaLink();
  const { data: galleryData } = useGetImageGallery(agentId);

  useEffect(() => {
    if (galleryData?.images) setGallery(galleryData.images);
  }, [galleryData]);

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) return;
    try {
      const res = await generateMutation.mutateAsync({
        data: { prompt: imagePrompt, style: imageStyle, agentId }
      });
      if (res.gallery) setGallery(res.gallery);
      toast({ title: "Imagem gerada com sucesso!" });
    } catch {
      toast({ title: "Erro ao gerar imagem", variant: "destructive" });
    }
  };

  const handleCanvaLink = async (contentType: string, label: string) => {
    try {
      const res = await canvaMutation.mutateAsync({
        data: { contentType, title: `Tax Group - ${agentName} - ${label}` }
      });
      if (res.url) window.open(res.url, "_blank");
    } catch {
      toast({ title: "Erro ao gerar link do Canva", variant: "destructive" });
    }
  };

  const handleDownload = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  };

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="w-96 border-l border-border/50 bg-card/50 backdrop-blur-xl flex flex-col h-full overflow-hidden"
    >
      <div className="p-4 border-b border-border/50 flex items-center justify-between bg-gradient-to-r from-purple-500/10 to-blue-500/10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <h3 className="font-bold text-sm">Design Studio</h3>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <Tabs defaultValue="generate" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-4 mt-3 bg-background/50">
          <TabsTrigger value="generate" className="text-xs gap-1.5">
            <ImageIcon className="w-3.5 h-3.5" /> Gerar Imagem
          </TabsTrigger>
          <TabsTrigger value="canva" className="text-xs gap-1.5">
            <Palette className="w-3.5 h-3.5" /> Canva
          </TabsTrigger>
          <TabsTrigger value="gallery" className="text-xs gap-1.5">
            <Grid3X3 className="w-3.5 h-3.5" /> Galeria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="flex-1 overflow-y-auto p-4 space-y-4 m-0">
          <div className="space-y-3">
            <textarea
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              placeholder="Descreva a imagem que deseja gerar..."
              className="w-full bg-background border border-border rounded-xl p-3 text-sm min-h-[80px] resize-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all"
            />
            <select
              value={imageStyle}
              onChange={(e) => setImageStyle(e.target.value)}
              className="w-full bg-background border border-border rounded-xl p-2.5 text-sm focus:outline-none focus:border-primary transition-all"
            >
              <option value="professional">Profissional / Corporativo</option>
              <option value="modern">Moderno / Clean</option>
              <option value="infographic">Infográfico / Dados</option>
              <option value="illustration">Ilustração</option>
              <option value="photorealistic">Fotorrealista</option>
            </select>
            <button
              onClick={handleGenerateImage}
              disabled={!imagePrompt.trim() || generateMutation.isPending}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium text-sm disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              {generateMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Gerar Imagem</>
              )}
            </button>
          </div>

          {generateMutation.data?.imageUrl && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
              <div className="relative rounded-xl overflow-hidden border border-border/50">
                <img
                  src={generateMutation.data.imageUrl}
                  alt="Generated"
                  className="w-full aspect-square object-cover"
                />
              </div>
              <button
                onClick={() => handleDownload(generateMutation.data!.imageUrl, `tax-group-${Date.now()}.png`)}
                className="w-full py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </button>
            </motion.div>
          )}
        </TabsContent>

        <TabsContent value="canva" className="flex-1 overflow-y-auto p-4 m-0">
          <p className="text-xs text-muted-foreground mb-4">
            Abra templates do Canva pré-configurados para o seu conteúdo:
          </p>
          <div className="grid grid-cols-2 gap-3">
            {CANVA_TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => handleCanvaLink(t.id, t.label)}
                disabled={canvaMutation.isPending}
                className="p-4 rounded-xl border border-border/50 bg-background/50 hover:bg-primary/5 hover:border-primary/30 text-left transition-all hover:-translate-y-0.5 group"
              >
                <div className="text-2xl mb-2">{t.icon}</div>
                <div className="text-sm font-medium">{t.label}</div>
                <div className="text-[10px] text-muted-foreground mt-1">{t.desc}</div>
                <ExternalLink className="w-3 h-3 mt-2 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="gallery" className="flex-1 overflow-y-auto p-4 m-0">
          {gallery.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Grid3X3 className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Nenhuma imagem gerada ainda.</p>
              <p className="text-xs mt-1">Use a aba "Gerar Imagem" para criar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {gallery.map((img, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="relative rounded-xl overflow-hidden border border-border/50 group cursor-pointer"
                  onClick={() => setSelectedImage(img.url)}
                >
                  <img src={img.url} alt={img.prompt} className="w-full aspect-square object-cover" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                    <p className="text-[10px] text-white line-clamp-2">{img.prompt}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-8"
            onClick={() => setSelectedImage(null)}
          >
            <img src={selectedImage} alt="Preview" className="max-w-full max-h-full rounded-xl" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

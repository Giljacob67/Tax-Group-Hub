import { useState } from "react";
import { motion } from "framer-motion";
import { Image as ImageIcon, Link2, Sparkles, Wand2, PenTool, Loader2 } from "lucide-react";
import { useGenerateImage, useGetCanvaLink } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export default function Integrations() {
  const { toast } = useToast();
  
  // Image Gen State
  const [imgPrompt, setImgPrompt] = useState("");
  const [generatedImg, setGeneratedImg] = useState<string | null>(null);
  const imageMutation = useGenerateImage();

  // Canva State
  const [canvaType, setCanvaType] = useState("presentation");
  const canvaMutation = useGetCanvaLink();

  const handleGenerateImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imgPrompt) return;
    try {
      const res = await imageMutation.mutateAsync({ data: { prompt: imgPrompt, style: "corporate" } });
      setGeneratedImg(res.imageUrl);
      toast({ title: "Imagem gerada com sucesso!" });
    } catch (err) {
      toast({ title: "Erro ao gerar imagem", variant: "destructive" });
    }
  };

  const handleCanvaLink = async () => {
    try {
      const res = await canvaMutation.mutateAsync({ data: { contentType: canvaType } });
      window.open(res.url, "_blank");
    } catch (err) {
      toast({ title: "Erro ao gerar link do Canva", variant: "destructive" });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-12">
        
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">AI Integrations</h1>
          <p className="text-muted-foreground">Extend your workflow with external AI tools and platform deep links.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Image Generation */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg"
          >
            <div className="p-6 border-b border-border/50 bg-gradient-to-br from-blue-500/10 to-transparent">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4 border border-blue-500/30">
                <ImageIcon className="w-6 h-6 text-blue-400" />
              </div>
              <h2 className="text-xl font-bold">Geração de Imagens</h2>
              <p className="text-sm text-muted-foreground mt-1">Tecnologia Google Gemini</p>
            </div>
            
            <div className="p-6">
              <form onSubmit={handleGenerateImage} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Descreva a imagem desejada</label>
                  <textarea 
                    value={imgPrompt}
                    onChange={(e) => setImgPrompt(e.target.value)}
                    placeholder="Describe the image you need for your marketing material..."
                    className="w-full bg-background border border-border rounded-xl p-3 text-sm min-h-[100px] focus:ring-1 focus:ring-primary outline-none resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={imageMutation.isPending || !imgPrompt}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center"
                >
                  {imageMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-4 h-4 mr-2" /> Gerar Imagem</>}
                </button>
              </form>

              {generatedImg && (
                <div className="mt-6 rounded-xl overflow-hidden border border-border relative group">
                  <img src={generatedImg} alt="Generated" className="w-full h-auto" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = generatedImg;
                        link.download = `tax-group-ai-${Date.now()}.png`;
                        link.click();
                      }}
                      className="bg-white/20 hover:bg-white/30 backdrop-blur-md px-4 py-2 rounded-lg text-white font-medium text-sm transition-colors cursor-pointer"
                    >
                      Download
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Canva Integration */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg h-fit"
          >
            <div className="p-6 border-b border-border/50 bg-gradient-to-br from-purple-500/10 to-transparent">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4 border border-purple-500/30">
                <PenTool className="w-6 h-6 text-purple-400" />
              </div>
              <h2 className="text-xl font-bold">Canva Workspace</h2>
              <p className="text-sm text-muted-foreground mt-1">Links diretos para edição avançada</p>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <label className="text-sm font-medium mb-3 block">Selecione o tipo de modelo</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "presentation", label: "Presentation" },
                    { id: "social_post", label: "Social Media" },
                    { id: "document", label: "Document" },
                    { id: "flyer", label: "Flyer" }
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setCanvaType(t.id)}
                      className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                        canvaType === t.id 
                          ? 'bg-purple-500/10 border-purple-500 text-purple-400' 
                          : 'bg-background border-border hover:border-purple-500/50'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <button
                onClick={handleCanvaLink}
                disabled={canvaMutation.isPending}
                className="w-full py-3 px-4 bg-card border-2 border-purple-500 hover:bg-purple-500/10 text-white rounded-xl font-medium transition-all shadow-md flex items-center justify-center"
              >
                {canvaMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Link2 className="w-4 h-4 mr-2" /> Abrir no Canva</>}
              </button>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}

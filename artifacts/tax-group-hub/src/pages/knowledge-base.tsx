import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { 
  FileText, UploadCloud, Trash2, Shield, Search, 
  Database, Loader2, File, FileImage, FileVideo, AlertCircle
} from "lucide-react";
import { 
  useListKnowledgeDocuments, 
  useRequestUploadUrl, 
  useDeleteKnowledgeDocument,
  useSearchKnowledge
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListKnowledgeDocumentsQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { formatBytes } from "@/lib/utils";

export default function KnowledgeBase() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: docsData, isLoading: isLoadingDocs } = useListKnowledgeDocuments();
  const uploadUrlMutation = useRequestUploadUrl();
  const deleteMutation = useDeleteKnowledgeDocument();
  const searchMutation = useSearchKnowledge();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles.length) return;
    
    setIsUploading(true);
    try {
      for (const file of acceptedFiles) {
        // 1. Get presigned URL
        const res = await uploadUrlMutation.mutateAsync({
          data: {
            agentId: "global", // Or specific agent ID if context allows
            filename: file.name,
            fileType: file.type || "application/octet-stream",
            fileSize: file.size
          }
        });

        // 2. Upload directly to storage (S3/GCS)
        const uploadRes = await fetch(res.uploadUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type || "application/octet-stream"
          }
        });

        if (!uploadRes.ok) throw new Error("Upload failed");
        
        toast({ title: `${file.name} uploaded successfully` });
      }
      queryClient.invalidateQueries({ queryKey: getListKnowledgeDocumentsQueryKey() });
    } catch (err) {
      toast({ 
        title: "Upload Error", 
        description: "Failed to upload document. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setIsUploading(false);
    }
  }, [uploadUrlMutation, queryClient, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync({ documentId: id });
      queryClient.invalidateQueries({ queryKey: getListKnowledgeDocumentsQueryKey() });
      toast({ title: "Document deleted" });
    } catch (err) {
      toast({ title: "Failed to delete document", variant: "destructive" });
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    try {
      const res = await searchMutation.mutateAsync({
        data: { query: searchQuery, limit: 5 }
      });
      // Handle search results in a real app (e.g. open modal)
      toast({ title: `Found ${res.results.length} results for "${searchQuery}"` });
    } catch (err) {
      toast({ title: "Search failed", variant: "destructive" });
    }
  };

  const getFileIcon = (type: string) => {
    if (type.includes('image')) return <FileImage className="w-8 h-8 text-blue-400" />;
    if (type.includes('video')) return <FileVideo className="w-8 h-8 text-purple-400" />;
    if (type.includes('pdf')) return <FileText className="w-8 h-8 text-red-400" />;
    return <File className="w-8 h-8 text-muted-foreground" />;
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
            <p className="text-muted-foreground mt-1">Manage documents used by agents for Retrieval-Augmented Generation (RAG).</p>
          </div>
          
          <form onSubmit={handleSearch} className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Semantic search across docs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </form>
        </div>

        {/* Upload Area */}
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 ${
            isDragActive 
              ? 'border-primary bg-primary/10 shadow-[0_0_20px_rgba(30,64,175,0.2)]' 
              : 'border-border/60 hover:border-primary/50 hover:bg-card/50'
          }`}
        >
          <input {...getInputProps()} />
          <div className="w-16 h-16 mx-auto bg-card rounded-full flex items-center justify-center mb-4 shadow-sm border border-border/50">
            {isUploading ? (
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            ) : (
              <UploadCloud className={`w-8 h-8 ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`} />
            )}
          </div>
          <h3 className="text-lg font-semibold mb-1">
            {isDragActive ? "Drop files here..." : "Drag & drop files or click to upload"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Supports PDF, Word (.docx), Markdown, TXT, Images, and Videos up to 50MB. Files are securely processed and vectorized for AI search.
          </p>
        </div>

        {/* Document List */}
        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <Database className="w-5 h-5 mr-2 text-primary" /> Indexed Documents
          </h2>
          
          {isLoadingDocs ? (
            <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : docsData?.documents?.length === 0 ? (
            <div className="text-center py-16 bg-card/30 rounded-2xl border border-border/50">
              <Shield className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground">No documents yet</h3>
              <p className="text-muted-foreground">Upload your first document to enhance agent knowledge.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {docsData?.documents?.map((doc, i) => (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  key={doc.id}
                  className="bg-card border border-border/50 hover:border-primary/30 rounded-xl p-5 group transition-all hover:shadow-lg"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 overflow-hidden">
                      <div className="p-2 bg-background rounded-lg border border-border/50 flex-shrink-0">
                        {getFileIcon(doc.fileType)}
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="font-semibold text-sm truncate text-foreground" title={doc.filename}>{doc.filename}</h4>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs text-muted-foreground">{formatBytes(doc.fileSize)}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">
                            {doc.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Uploaded {format(new Date(doc.createdAt), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => handleDelete(doc.id)}
                      disabled={deleteMutation.isPending}
                      className="opacity-0 group-hover:opacity-100 p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

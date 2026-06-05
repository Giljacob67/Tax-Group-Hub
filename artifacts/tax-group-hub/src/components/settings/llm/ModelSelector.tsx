import { useState } from "react";
import {
  Check,
  ChevronDown,
  Cpu,
  Wifi,
  WifiOff,
  AlertCircle,
} from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import type { LlmConnection } from "./types";
import { useListLlmConnections } from "@workspace/api-client-react";

interface Props {
  value?: number | null;
  onChange: (connection: LlmConnection | null) => void;
  placeholder?: string;
}

export default function ModelSelector({
  value,
  onChange,
  placeholder = "Selecionar modelo...",
}: Props) {
  const [open, setOpen] = useState(false);

  const { data, isLoading: loading } = useListLlmConnections();
  const connections: LlmConnection[] =
    (data?.connections as unknown as LlmConnection[]) || [];

  const selected = connections.find((c) => c.id === value);

  const providerColor = (provider: string) => {
    const map: Record<string, string> = {
      openai: "text-emerald-400",
      anthropic: "text-amber-400",
      google: "text-blue-400",
      openrouter: "text-purple-400",
      ollama: "text-sky-400",
      ollama_cloud: "text-sky-300",
      custom_openai: "text-gray-400",
    };
    return map[provider] || "text-muted-foreground";
  };

  const providerIcon = (provider: string) => {
    const map: Record<string, string> = {
      openai: "⬡",
      anthropic: "◈",
      google: "✦",
      openrouter: "⇌",
      ollama: "🦙",
      ollama_cloud: "☁",
      custom_openai: "⚙",
    };
    return map[provider] || "◈";
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between text-xs h-9"
        >
          {selected ? (
            <div className="flex items-center gap-2 truncate">
              <span className={providerColor(selected.provider)}>
                {providerIcon(selected.provider)}
              </span>
              <span className="truncate">{selected.name}</span>
              {selected.lastTestStatus === "ok" ? (
                <Wifi className="w-3 h-3 text-emerald-400 shrink-0" />
              ) : selected.lastTestStatus === "error" ? (
                <WifiOff className="w-3 h-3 text-red-400 shrink-0" />
              ) : (
                <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar modelo..." className="text-xs" />
          <CommandList>
            <CommandEmpty className="text-xs py-2 text-muted-foreground text-center">
              {loading ? "Carregando..." : "Nenhum modelo encontrado."}
            </CommandEmpty>
            <CommandGroup heading="Conectados">
              {connections.map((conn) => (
                <CommandItem
                  key={conn.id}
                  value={conn.name + " " + conn.modelId}
                  onSelect={() => {
                    onChange(conn);
                    setOpen(false);
                  }}
                  className="text-xs cursor-pointer"
                >
                  <div className="flex items-center gap-2 w-full">
                    <span className={`text-sm ${providerColor(conn.provider)}`}>
                      {providerIcon(conn.provider)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{conn.name}</div>
                      <div className="text-xs text-muted-foreground font-mono truncate">
                        {conn.modelId}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {conn.supportsVision && (
                        <span className="text-[11px] bg-blue-500/10 text-blue-400 px-1 rounded">
                          vision
                        </span>
                      )}
                      {conn.supportsTools && (
                        <span className="text-[11px] bg-emerald-500/10 text-emerald-400 px-1 rounded">
                          tools
                        </span>
                      )}
                      {value === conn.id && (
                        <Check className="w-3.5 h-3.5 text-primary" />
                      )}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

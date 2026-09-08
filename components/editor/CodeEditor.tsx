"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import CodeMirror from "@uiw/react-codemirror";
import { Decoration, EditorView } from "@codemirror/view";
import { StateField, type Extension } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type EditorLanguage = "javascript" | "python" | "java" | "c" | "cpp" | "csharp";

interface Props {
  /** The source code displayed in the editor. */
  value?: string;
  /** Called on every edit. */
  onChange?: (code: string) => void;
  /** Called when the user switches language via the toolbar toggle. */
  onLanguageChange?: (lang: EditorLanguage) => void;
  /** Language mode for syntax highlighting. */
  language?: EditorLanguage;
  /** 1-indexed line numbers to highlight as blame (failed stress test). */
  blameLines?: number[];
  /** Minimum editor height (CSS value). */
  minHeight?: string;
}

/* ------------------------------------------------------------------ */
/*  Language config                                                    */
/* ------------------------------------------------------------------ */

const LANGUAGE_OPTIONS: { value: EditorLanguage; label: string }[] = [
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "csharp", label: "C#" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
];

/* ------------------------------------------------------------------ */
/*  Default boilerplate templates                                      */
/* ------------------------------------------------------------------ */

const TEMPLATES: Record<EditorLanguage, string> = {
  javascript: `function executePipeline() {
    console.log("System initialized.");
}
executePipeline();`,

  python: `def main():
    print("System initialized.")

main()`,

  java: `import java.util.*;

class Main {
    public static void main(String[] args) {
        System.out.println("System initialized.");
    }
}`,

  c: `#include <stdio.h>

int main() {
    printf("System initialized.\\n");
    return 0;
}`,

  cpp: `#include <iostream>

int main() {
    std::cout << "System initialized." << std::endl;
    return 0;
}`,

  csharp: `using System;

namespace ChaosLab
{
    class Program
    {
        static void Main(string[] args)
        {
            Console.WriteLine("System initialized.");
        }
    }
}`,
};

function getExtension(lang: EditorLanguage) {
  switch (lang) {
    case "python":
      return python();
    case "java":
    case "csharp":
      return java();
    case "c":
    case "cpp":
      return cpp();
    default:
      return javascript();
  }
}

/* ------------------------------------------------------------------ */
/*  Blame line decoration                                              */
/* ------------------------------------------------------------------ */

const blameMark = Decoration.line({ class: "cm-blame-line" });
const blameGutterMark = Decoration.line({ class: "cm-blame-gutter-line" });

const blameTheme = EditorView.theme({
  ".cm-blame-line": {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderLeft: "3px solid rgba(239, 68, 68, 0.5)",
    paddingLeft: "4px",
  },
  ".cm-blame-line .cm-activeLineGutter": {
    backgroundColor: "rgba(239, 68, 68, 0.2) !important",
  },
  ".cm-blame-gutter-line .cm-gutterElement": {
    color: "rgb(239, 68, 68) !important",
  },
  ".cm-blame-gutter-line .cm-gutterElement::after": {
    content: "' \\26A0'",
    fontSize: "10px",
  },
});

function blameExtension(lines: number[]): Extension {
  if (!lines || lines.length === 0) return [];
  const unique = [...new Set(lines)];
  return [
    blameTheme,
    StateField.define({
      create(state) {
        const ranges = unique
          .filter((l) => l >= 1 && l <= state.doc.lines)
          .sort((a, b) => a - b)
          .map((lineNum) => {
            const line = state.doc.line(lineNum);
            return blameMark.range(line.from);
          });
        return Decoration.set(ranges);
      },
      update(decorations) {
        return decorations;
      },
      provide: (f) => EditorView.decorations.from(f),
    }),
    StateField.define({
      create(state) {
        const ranges = unique
          .filter((l) => l >= 1 && l <= state.doc.lines)
          .sort((a, b) => a - b)
          .map((lineNum) => {
            const line = state.doc.line(lineNum);
            return blameGutterMark.range(line.from);
          });
        return Decoration.set(ranges);
      },
      update(decorations) {
        return decorations;
      },
      provide: (f) => EditorView.decorations.from(f),
    }),
  ];
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CodeEditor({
  value = "",
  onChange,
  onLanguageChange,
  language = "javascript",
  blameLines,
  minHeight = "420px",
}: Props) {
  const [lang, setLang] = useState<EditorLanguage>(language);
  const extension = getExtension(lang);
  const blameExt = blameExtension(blameLines ?? []);
  const { resolvedTheme } = useTheme();

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
            Code Editor
          </span>
        </div>

        {/* Language toggle */}
        <div className="flex flex-wrap rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 p-0.5">
          {LANGUAGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setLang(opt.value);
                onChange?.(TEMPLATES[opt.value]);
                onLanguageChange?.(opt.value);
              }}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                lang === opt.value
                  ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                  : "text-zinc-600 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <CodeMirror
        value={value}
        onChange={(val) => onChange?.(val)}
        extensions={[extension, blameExt]}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        minHeight={minHeight}
        className="text-sm"
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          foldGutter: true,
          autocompletion: true,
          bracketMatching: true,
          closeBrackets: true,
        }}
      />
    </div>
  );
}

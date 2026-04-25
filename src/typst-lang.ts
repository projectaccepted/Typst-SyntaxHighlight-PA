import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { StreamLanguage } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

/* -------------------------------------------------- */
/*  Typst Language Definition                         */
/* -------------------------------------------------- */
export const typstLanguage = StreamLanguage.define({
  name: "typst",
  startState: () => ({
    inMath: false,
    inComment: false,
    codeDepth: 0,
    expectingDef: false, // Upozorní parser, že očekáváme název (např. po #let)
  }),
  
  token(stream, state) {
    // 1. Přeskočení mezer
    if (stream.eatSpace()) return null;
    
    // 2. Očekávání názvu proměnné/funkce po klíčovém slově 'let'
    if (state.expectingDef) {
      if (stream.match(/^[a-zA-Z_][a-zA-Z0-9_-]*/)) {
        state.expectingDef = false;
        // Vracíme "def", což znamená t.definition(t.variableName)
        return "def"; 
      }
      // Pokud následuje něco jiného (např. závorka), resetujeme očekávání
      state.expectingDef = false; 
    }

    // 3. Komentáře
    if (stream.match('//')) { stream.skipToEnd(); return "lineComment"; }
    if (stream.match('/*')) { state.inComment = true; return "blockComment"; }
    if (state.inComment) {
      if (stream.match('*/')) state.inComment = false;
      else stream.next();
      return "blockComment";
    }
    
    // 4. Stringy (uvozovky a backticky)
    if (stream.match(/^"/)) {
      while (stream.peek() && !stream.match(/^"/, false)) {
        if (stream.match(/^\\"/)) continue;
        stream.next();
      }
      stream.match(/^"/);
      return "string";
    }
    if (stream.match(/^`/)) {
      while (stream.peek() && !stream.match(/^`/, false)) stream.next();
      stream.match(/^`/);
      return "string";
    }
    
    // 5. Matematický blok
    if (stream.match('$')) {
      state.inMath = !state.inMath;
      return "keyword";
    }
    if (state.inMath) {
      if (stream.match(/^[a-zA-Z_][a-zA-Z0-9_]*/)) return "variableName";
      if (stream.match(/^\d+(\.\d+)?/)) return "number";
      stream.next();
      return "operator";
    }
    
    // 6. Inline formátování textu (Tučně a Kurzíva) - jen mimo kód a matiku
    if (state.codeDepth === 0 && !state.inMath) {
      // *tučně*
      if (stream.match(/^\*[^*]+\*/)) return "strong";
      // _kurzíva_
      if (stream.match(/^_[^_]+_/)) return "em";
    }

    // 7. Nadpisy
    if (stream.sol() && stream.match(/^=+\s/)) {
      stream.skipToEnd();
      return "heading";
    }
    
    // 8. Hash blok (#)
    if (stream.match('#')) {
      // Pokud narazíme na let, zapneme očekávání názvu definice
      if (stream.match(/^(let)\b/)) {
        state.expectingDef = true;
        return "keyword";
      }
      // Ostatní hash keywords
      if (stream.match(/^(import|include|set|show|if|else|for|while|break|continue|return)\b/)) {
        return "keyword";
      }
      // Volání funkce ihned za # (např. #rect, #process-data)
      if (stream.match(/^[a-zA-Z_][a-zA-Z0-9_-]*/)) {
        // "variable-2" se v Lezeru mapuje na t.special(t.variableName)
        return "variable-2"; 
      }
      return "operator";
    }

    // 9. Hlídání zanoření složených závorek (KÓD)
    if (stream.match('{')) { state.codeDepth++; return "brace"; }
    if (stream.match('}')) { if (state.codeDepth > 0) state.codeDepth--; return "brace"; }
    if (stream.match(/^[\[\]]/)) return "bracket";
    if (stream.match(/^[()]/)) return "paren";

    // 10. Čísla (s volitelnými jednotkami Typstu)
    if (stream.match(/^\d+(\.\d+)?(pt|px|em|%|deg|rad|mm|cm|in|fr)?\b/)) {
      return "number";
    }

    // ==========================================
    // PRAVIDLA POUZE PRO KÓD (Uvnitř složených závorek {})
    // ==========================================
    if (state.codeDepth > 0) {
      
      if (stream.match(/^(let)\b/)) {
        state.expectingDef = true;
        return "keyword";
      }

      if (stream.match(/^(set|show|import|include|if|else|for|while|break|continue|return|in|not|and|or|true|false|none|auto|with)\b/)) {
        return "keyword";
      }
      
      // Pojmenované parametry (např. width:)
      if (stream.match(/^[a-zA-Z_][a-zA-Z0-9_-]*:/)) {
        return "propertyName";
      }
      
      // Detekce volání funkcí uvnitř kódu (např. push() nebo rect())
      // Zjistíme to tak, že se podíváme, jestli za názvem následuje levá závorka '('
      if (stream.match(/^[a-zA-Z_][a-zA-Z0-9_-]*(?=\s*\()/)) {
        return "variable-2"; // Opět obarvíme jako funkci
      }
      
      // Obyčejné proměnné
      if (stream.match(/^[a-zA-Z_][a-zA-Z0-9_-]*/)) {
        return "variableName";
      }
      
      // Operátory
      if (stream.match(/^[+\-*\/=<>!&|:;,\.]/)) {
        return "operator";
      }
    }
    
    stream.next();
    return null; 
  }
});

/* -------------------------------------------------- */
/*  Official Typst Colors (Light Mode)                */
/* -------------------------------------------------- */
export const typstHighlightStyle = HighlightStyle.define([
  { tag: t.lineComment, color: "#6a737d", fontStyle: "italic" },
  { tag: t.blockComment, color: "#6a737d", fontStyle: "italic" },
  
  // Klíčová slova (červená)
  { tag: t.keyword, color: "#d73a49", fontWeight: "bold" },
  
  // Názvy při definici, např. 'process-data' po #let (Fialová, navíc tučnější ať vynikne)
  { tag: t.definition(t.variableName), color: "#6f42c1", fontWeight: "600" },
  
  // Volání funkcí, např. #rect nebo push() (Fialová)
  { tag: t.special(t.variableName), color: "#6f42c1" },
  
  // Stringy a Čísla
  { tag: t.string, color: "#22863a" },
  { tag: t.number, color: "#005cc5" },
  
  // Nadpisy
  { tag: t.heading, color: "#6f42c1", fontWeight: "bold" },
  
  // Obyčejné proměnné (Černé)
  { tag: t.variableName, color: "#24292e" },
  
  // Parametry (Modrá) - width:
  { tag: t.propertyName, color: "#005cc5" },
  
  // Operátory (+, -, atd.)
  { tag: t.operator, color: "#d73a49" },
  
  // Závorky
  { tag: t.bracket, color: "#24292e" },
  { tag: t.brace, color: "#24292e" },
  { tag: t.paren, color: "#24292e" },
  
  // ==========================================
  // INLINE FORMÁTOVÁNÍ (Markup)
  // ==========================================
  { tag: t.strong, fontWeight: "bold", color: "#24292e" },     // *tučně*
  { tag: t.emphasis, fontStyle: "italic", color: "#24292e" },  // _kurzíva_
]);

/* -------------------------------------------------- */
/*  Export syntax highlighting                        */
/* -------------------------------------------------- */
export const typstSyntax = () => [
  typstLanguage,
  syntaxHighlighting(typstHighlightStyle)
];

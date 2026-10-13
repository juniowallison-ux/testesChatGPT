// A mesma implementação é empacotada nas Edge Functions e no navegador.
export {
  wrapEssay,
  suspiciousLines,
  snapScore,
  sha256,
  parseJsonResponse,
  validEvidence,
  rtfEscape,
} from '../../supabase/functions/_shared/essay.ts';

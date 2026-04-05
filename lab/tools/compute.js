import { z } from 'zod/v4';
import { logger } from '../logger.js';

export function registerComputeTools(server) {
  // Tool 1: Safe Math Evaluator
  server.tool(
    'calculate',
    'Evaluate a mathematical expression. Supports +,-,*,/,**,Math functions. Returns numeric result. DO NOT use for currency formatting — that is a separate tool.',
    { expression: z.string().describe('Math expression, e.g. Math.sqrt(144) + 5 * 2') },
    async ({ expression }) => {
      logger.info('calculate', 'Evaluating', { expression });
      const safe = /^[\d\s+\-*/%().,MathsqrtpowlogabsfloorcelroundPIE]+$/.test(expression);
      if (!safe) {
        logger.warn('calculate', 'Blocked unsafe expression', { expression });
        return { content:[{type:'text',text:'Error: Expression contains disallowed characters.'}], isError:true };
      }
      try {
        const result = Function('Math', '"use strict"; return (' + expression + ')')(Math);
        logger.info('calculate', 'Result', { result });
        return { content:[{type:'text',text:`${expression} = ${result}`}] };
      } catch(e) {
        return { content:[{type:'text',text:`Error: ${e.message}`}], isError:true };
      }
    }
  );

  // Tool 2: Unit Converter
  server.tool(
    'convert_units',
    'Convert a value between common units: length (m,km,ft,mi), weight (kg,lb,oz), temperature (C,F,K), data (B,KB,MB,GB).',
    {
      value: z.number().describe('Numeric value to convert'),
      from_unit: z.string().describe('Source unit abbreviation'),
      to_unit: z.string().describe('Target unit abbreviation'),
    },
    async ({ value, from_unit, to_unit }) => {
      const conversions = {
        m_km: v=>v/1000,     km_m: v=>v*1000,
        m_ft: v=>v*3.28084,  ft_m: v=>v/3.28084,
        km_mi: v=>v*0.62137, mi_km: v=>v/0.62137,
        kg_lb: v=>v*2.20462, lb_kg: v=>v/2.20462,
        C_F: v=>v*9/5+32,    F_C: v=>(v-32)*5/9,
        C_K: v=>v+273.15,    K_C: v=>v-273.15,
        MB_GB: v=>v/1024,    GB_MB: v=>v*1024,
        KB_MB: v=>v/1024,    MB_KB: v=>v*1024,
      };
      const key = `${from_unit}_${to_unit}`;
      if (!conversions[key])
        return { content:[{type:'text',text:`Unsupported conversion: ${key}`}], isError:true };
      const result = conversions[key](value);
      return { content:[{type:'text',text:`${value} ${from_unit} = ${result.toFixed(4)} ${to_unit}`}] };
    }
  );
}

import json
import os
import re
from collections import deque
import sys
import io
from pathlib import Path

# IMPORTANT: Set the output encoding to UTF-8 for correct display in Windows console (CMD)
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")


# --- ГЛОБАЛЬНЫЕ КОНСТАНТЫ И КОНФИГУРАЦИЯ ---
INBOX_PATH = "0-Inbox"  
OUTPUT_JS_PATH = "scripts" 
KB_FOLDER = "2-Areas/AMMS-KB"
SYSTEMS_FOLDER = "2-Areas/AMMS-Systems"
MAPS_FOLDER = "2-Areas/AMMS-Maps"

# Идентификаторы MMSS для универсального поиска JSON в Markdown
MMSS_ID_KEYS = [
    "MMSS_System_Activation",
    "DEPLOYMENT_MANIFEST",
    "MMSS_SYSTEM_SPECIFICATION",
    "COMPLETE_MMSS_SYSTEM_ACTIVATION_PACKAGE" # Добавлен ключ из примера
]

# Priority key map for entity search
KEY_MAP = {
    'systemId': ['system_id', 'SYSTEM_ID', 'system_name', 'pkg', 'id'],
    'version': ['version', 'VERSION', 'v'],
    'state': ['activation_status', 'system_state', 'state'],
    # Search for blocks containing V, N, D_f
    'metrics_block': ['current_metrics', 'real_time_metrics', 'metrics', 'MMSS_Metrics', 'PERFORMANCE_METRICS', 'MINIMAL_PERFORMANCE_GUARANTEE', 'FOUNDATIONAL_METRICS'],
    # Search for arrays or objects containing operators
    'operators_list': ['operators', 'ops_library', 'MIX_patterns', 'rules', 'quantum_operators'],
}


# --- УНИВЕРСАЛЬНЫЙ ЭКСТРАКТОР JSON (Обновлено) ---
def extract_mmss_json(markdown_content: str) -> str:
    """
    Универсально находит и извлекает первый JSON-блок, содержащий MMSS-ключи, 
    из Markdown-строки, независимо от метки языка кодового блока.
    """
    
    # Регулярное выражение для поиска кодовых блоков: ```[язык]\n(контент)\n```
    CODE_BLOCK_REGEX = r"^\s*```[a-zA-Z0-9-]*\n(?P<content>.*?)\n\s*```\s*$"
    
    matches = re.finditer(CODE_BLOCK_REGEX, markdown_content, re.MULTILINE | re.DOTALL)
    
    for match in matches:
        raw_json_string = match.group('content').strip()
        
        if not raw_json_string:
            continue

        try:
            data = json.loads(raw_json_string)
            
            # Проверка наличия ключевых MMSS-идентификаторов в JSON
            if any(key in data for key in MMSS_ID_KEYS):
                # Если найден, возвращаем его чистую строку
                return json.dumps(data, indent=2, ensure_ascii=False)
            
        except json.JSONDecodeError:
            # Это не JSON. Продолжаем поиск.
            continue

    return ""


# --- DEEP SEARCH UTILITY ---
def deep_search(obj, target_keys, path="systemData"):
    """Recursively searches for target keys and returns the first found JS path."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            # Protection against special characters in JSON keys (e.g., 'V.01')
            js_key = f"['{k}']" if re.search(r'[^a-zA-Z0-9_]', k) else f".{k}"
            current_path = path + js_key

            if k in target_keys:
                return current_path
            
            # Recursive search in values
            if isinstance(v, dict):
                result = deep_search(v, target_keys, current_path)
                if result:
                    return result
            
            # Special check for operator lists: if the key is a target and the value is a list/dict (potential operators block)
            if k in target_keys and (isinstance(v, list) or isinstance(v, dict)):
                 return current_path

    return None

# --- JS SCRIPT GENERATION ---
def generate_js_importer(system_id_path, metrics_block_path, operators_path):
    """Generates a specialized JS script for QuickAdd."""
    
    # 1. Generate logic for systemId
    system_id_logic = f"    let systemId = {system_id_path} || 'unknown_system';"
    
    # 2. Generate logic for metrics V, N, D_f (Complex logic remains robust)
    metrics_logic = f"""
    let metrics = {{ V: 0.95, N: 0.95, S: 0.05, D_f: 9.0 }};
    const metricsBlock = {metrics_block_path}; // Path to the metrics block

    if (metricsBlock) {{
        // Attempt to extract V, N, D_f, S from the found block
        // Priority: V_Semantic_Value > V > SemanticValue (handles nested structures like FOUNDATIONAL_METRICS.V.target)
        metrics.V = parseFloat(metricsBlock.V_Semantic_Value) 
            || parseFloat(metricsBlock.V?.target || metricsBlock.V || metricsBlock['V'] || metricsBlock.SemanticValue) 
            || metrics.V;
            
        // Priority: N_Structural_Order > N > Negentropy
        metrics.N = parseFloat(metricsBlock.N_Structural_Order) 
            || parseFloat(metricsBlock.N?.target || metricsBlock.N || metricsBlock['N'] || metricsBlock.Negentropy) 
            || metrics.N;
            
        // Priority: S_Semantic_Entropy > S > Entropy
        metrics.S = parseFloat(metricsBlock.S_Semantic_Entropy) 
            || parseFloat(metricsBlock.S?.target || metricsBlock.S || metricsBlock['S'] || metricsBlock.Entropy) 
            || metrics.S;

        // Priority: D_f_Fractal_Dimension > D_f > FractalDimension
        metrics.D_f = parseFloat(metricsBlock.D_f_Fractal_Dimension) 
            || parseFloat(metricsBlock.D_f?.target || metricsBlock.D_f || metricsBlock['D_f'] || metricsBlock.FractalDimension) 
            || metrics.D_f;
            
        // Convert metrics to fixed strings if they were successfully parsed (to avoid "NaN")
        metrics.V = isNaN(metrics.V) ? 0.95 : metrics.V;
        metrics.N = isNaN(metrics.N) ? 0.95 : metrics.N;
        metrics.S = isNaN(metrics.S) ? 0.05 : metrics.S;
        metrics.D_f = isNaN(metrics.D_f) ? 9.0 : metrics.D_f;
    }}
    """
    
    # 3. Generate logic for operators
    # Use fr""" (Formatted Raw String) for correct handling of multiline template with \`\`\`math symbols
    operators_logic = fr"""
    const operatorsData = {operators_path}; // Path to operators
    let operatorsCreated = 0;
    let relatedOperators = []; // For the relationship map file

    if (operatorsData && typeof operatorsData === 'object' && operatorsData !== null) {{
        const opsToIterate = Array.isArray(operatorsData) ? operatorsData : Object.values(operatorsData);

        for (const opData of opsToIterate) {{
            // Key definition: 'i' for arrays or 'opKeyRaw' for objects
            const opKeyRaw = opData.i || (opData.id) || (opData.name) || (Object.keys(operatorsData).find(key => operatorsData[key] === opData));
            
            // We check for formula or short formula 'f' to ensure it's a valid operator
            if (opKeyRaw && (opData.formula || opData.f)) {{
                const opKey = String(opKeyRaw).replace(/[^a-zA-Z0-9_]/g, '_').replace(/\s+/g, '-');
                
                let formula = opData.formula || opData.f || 'N/A';
                let purpose = opData.purpose || opData.ru_пояснение || opData.description || 'N/A';
                let domain = opData.domain || opData.category || 'General';

                // Create link for the map
                relatedOperators.push(`[[${{opKey}}]]`);

                const opContent = `---
operator_id: "${{opKey}}"
type: "operator"
category: "${{domain}}"
formula: "${{formula.replace(/"/g, '\\\\"')}}"
purpose: "${{purpose.replace(/"/g, '\\\\"')}}"
system_ref: [[${{safeSystemId}}]]
tags: [AMMS/KB, AMMS/Imported, AMMS/${{domain}}]
---
# ${{opKey}}
## Purpose
${{purpose}}
## Formula
\n\`\`\`math\n\${{formula}}\n\`\`\`\n
---
*Imported from System: ${{safeSystemId}}*
`;
                await app.vault.create("{KB_FOLDER}/${{opKey}}.md", opContent);
                operatorsCreated++;
            }}
        }}
    }}
    """.replace("{KB_FOLDER}", KB_FOLDER)
    
    # 4. Assemble the final JS script template (considering folders)
    # Use fr""" (Formatted Raw String) for correct handling of multiline template with \`\`\`json symbols
    js_template = fr"""
module.exports = async (params) => {{
    const {{ quickAddApi, app }} = params;
    
    // Utility: safely cleans the ID for file names and paths
    const SAFE_SYSTEM_ID = (id) => String(id).replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '-');

    try {{
        // Prompt user for JSON input (This is generated by our Python script)
        const jsonInput = await quickAddApi.inputPrompt("Insert System JSON (Generated by Python):");
        let systemData = JSON.parse(jsonInput);

        // --- DYNAMICALLY EXTRACTED PATHS ---
{system_id_logic}
{metrics_logic}
        // --- END OF DYNAMIC PATHS ---
        
        let safeSystemId = SAFE_SYSTEM_ID(systemId);
        
        // 1. CREATE SYSTEM FILE (2-Areas/AMMS-Systems)
        const systemContent = `---
system_id: "${{safeSystemId}}"
version: "DYNAMIC"
state: "Imported"
metrics:
  V: ${{metrics.V}}
  N: ${{metrics.N}}
  S: ${{metrics.S}}
  D_f: ${{metrics.D_f}}
tags: [AMMS/Systems, AMMS/Dynamic_Import]
---
# ${{safeSystemId}}
## Original JSON Export
\n\`\`\`json\n\${{JSON.stringify(systemData, null, 2)}}\n\`\`\`\n
`;
        await app.vault.create("{SYSTEMS_FOLDER}/${{safeSystemId}}.md", systemContent);
        
        // 2. IMPORT OPERATORS (2-Areas/AMMS-KB)
{operators_logic}

        // 3. CREATE RELATIONSHIP MAP FILE (REVERSE ASSEMBLY) (2-Areas/AMMS-Maps)
        const relationsContent = `---
type: system_map
system_ref: [[${{safeSystemId}}]]
tags: [AMMS/Map]
---
# Relationship Map ${{safeSystemId}}
## Main System
[[${{safeSystemId}}]]

## Imported Operators (${{operatorsCreated}})
${{relatedOperators.join('\n')}}

---
*Auto-generated based on structure: {system_id_path}*
`;
        await app.vault.create("{MAPS_FOLDER}/${{safeSystemId}}_Map.md", relationsContent);

        new Notice(`✅ Успешный Динамический Импорт: ${{safeSystemId}}. Создано операторов: ${{operatorsCreated}}`);

    }} catch (error) {{
        new Notice(`❌ Критическая ошибка импорта. Проверьте JSON и консоль.`);
        console.error("Dynamic Import Error:", error);
    }}
}};
    """.replace("{SYSTEMS_FOLDER}", SYSTEMS_FOLDER).replace("{MAPS_FOLDER}", MAPS_FOLDER)
    
    return js_template


# --- MAIN LOGIC ---
def main():
    # 1. Ensure CWD is Vault root (D:\AMMS-Vault)
    if not os.path.isdir(INBOX_PATH):
        print(f"ОШИБКА: Не найдена папка {INBOX_PATH}. Убедитесь, что скрипт запускается из корня Vault.", file=sys.stderr)
        return
        
    print(f"Сканирование {INBOX_PATH} на наличие новых систем...")
    
    # 2. Find a new file in Inbox
    new_files = [f for f in os.listdir(INBOX_PATH) if f.endswith(('.json', '.md'))]
    if not new_files:
        print("Не найдено новых MMSS-систем в Inbox.")
        return

    # Take the first found file
    file_to_analyze = os.path.join(INBOX_PATH, new_files[0])
    
    # 3. Extract JSON using the universal method
    with open(file_to_analyze, 'r', encoding='utf-8') as f:
        content = f.read()
        
    json_str = ""
    if file_to_analyze.lower().endswith('.md'):
        # Используем универсальный экстрактор для Markdown
        json_str = extract_mmss_json(content)
    else: 
        # Для .json файлов берем все содержимое
        json_str = content
        
    if not json_str.strip():
        print(f"ПРЕДУПРЕЖДЕНИЕ: В файле '{Path(file_to_analyze).name}' не найден валидный JSON-манифест, содержащий MMSS-ключи.", file=sys.stderr)
        return

    try:
        system_data = json.loads(json_str)
        print("✅ JSON-манифест успешно загружен и проверен.")
    except json.JSONDecodeError as e:
        print(f"КРИТИЧЕСКАЯ ОШИБКА парсинга JSON в {Path(file_to_analyze).name}. Проверьте синтаксис.", file=sys.stderr)
        print(f"Детали ошибки: {e}", file=sys.stderr)
        return

    # 4. Deep analysis to determine paths
    
    system_id_path = deep_search(system_data, KEY_MAP['systemId'])
    metrics_block_path = deep_search(system_data, KEY_MAP['metrics_block'])
    operators_path = deep_search(system_data, KEY_MAP['operators_list'])

    if not system_id_path:
        print("КРИТИЧЕСКАЯ ОШИБКА: Не удалось найти путь к systemId. Импорт невозможен.", file=sys.stderr)
        return
        
    # Fallbacks
    if not metrics_block_path:
        metrics_block_path = "systemData" # Если блок метрик не найден, ищем метрики в корне
        
    if not operators_path:
        operators_path = "{}" # Если операторы не найдены, используем пустой объект
        print("ПРЕДУПРЕЖДЕНИЕ: Не найден путь к списку операторов. Будет создана только карточка Системы.")


    # 5. Generation and saving of the JS script
    generated_js_content = generate_js_importer(metrics_block_path=metrics_block_path, 
                                                operators_path=operators_path, 
                                                system_id_path=system_id_path)
    
    # Извлечение и санитаризация ID для имени файла (улучшенный FIX)
    system_id_raw = system_data
    try:
        # Траверс JSON, чтобы получить фактическое значение ID
        path_parts = system_id_path.replace('systemData', '').strip('.').split('.')
        for part in path_parts:
            if part.startswith("['") and part.endswith("']"):
                key = part.strip("['']")
                system_id_raw = system_id_raw.get(key, 'DYNAMIC_ID')
            elif part and part != 'systemData':
                system_id_raw = system_id_raw.get(part, 'DYNAMIC_ID')

        system_id_raw_str = str(system_id_raw)
        # 1. Замена всех небезопасных символов на '_'
        temp_id = re.sub(r'[^a-zA-Z0-9_-]', '_', system_id_raw_str)
        # 2. Замена последовательностей пробелов/подчеркиваний на единичный дефис
        system_id_for_filename = re.sub(r'[_\s]+', '-', temp_id).strip('-') 

    except Exception:
        system_id_for_filename = "DYNAMIC_IMPORTER"
        
    output_filename = f"dynamic_importer_{system_id_for_filename}.js"
    output_path = os.path.join(OUTPUT_JS_PATH, output_filename)
    
    os.makedirs(OUTPUT_JS_PATH, exist_ok=True)
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(generated_js_content)
            
        print(f"\n✅ Скрипт успешно сгенерирован: {output_path}")

    except Exception as e:
        print(f"ОШИБКА при сохранении JS файла: {e}", file=sys.stderr)
        return

    # 6. Move the file after analysis
    import_ready_dir = os.path.join(INBOX_PATH, "_Ready_For_Import")
    os.makedirs(import_ready_dir, exist_ok=True)
    try:
        os.rename(file_to_analyze, os.path.join(import_ready_dir, new_files[0]))
        print(f"Исходный файл перемещен в: {import_ready_dir}")
    except Exception as e:
        print(f"Не удалось переместить файл: {e}", file=sys.stderr)

if __name__ == "__main__":
    main()
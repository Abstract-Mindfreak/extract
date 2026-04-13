import json
import os

def get_default_rules():
    return {
        "composition_rules": [
            {
                "name": "layer_balance",
                "logic": "must_include_layers",
                "value": [1, 2, 3]
            },
            {
                "name": "domain_spread",
                "logic": "min_domains",
                "value": 2
            },
            {
                "name": "logic_anchor",
                "logic": "conditional_requirement",
                "if": {"domain": "Logic"},
                "then": {"min_count": 1}
            }
        ]
    }

def validate_selection(blocks, rules=None):
    if rules is None:
        rules = get_default_rules()
        
    report = {"valid": True, "errors": []}
    
    layers_present = set(b["attr"]["layer"] for b in blocks)
    domains_present = set(b["attr"]["domain"] for b in blocks)
    
    for rule in rules["composition_rules"]:
        if rule["logic"] == "must_include_layers":
            required = set(rule["value"])
            missing = required - layers_present
            if missing:
                report["valid"] = False
                report["errors"].append(f"Missing layers: {list(missing)}")
                
        elif rule["logic"] == "min_domains":
            if len(domains_present) < rule["value"]:
                report["valid"] = False
                report["errors"].append(f"Not enough domains: {len(domains_present)} < {rule['value']}")
                
        elif rule["logic"] == "conditional_requirement":
            # Simple check: if any block matches 'if', ensure 'then' condition
            # Logic domain check
            if rule["if"].get("domain") == "Logic":
                logic_blocks = [b for b in blocks if b["attr"]["domain"] == "Logic"]
                if len(logic_blocks) < rule["then"].get("min_count", 0):
                    report["valid"] = False
                    report["errors"].append("Logic anchor requirement not met")
                    
    return report

def enforce_rules(blocks, rules=None):
    # This function could potentially suggest or filter blocks to satisfy rules
    # For now, it just returns the validation report
    return validate_selection(blocks, rules)

def main():
    output_path = os.path.join('prompt-db-local', 'database', 'system', 'rules.json')
    rules = get_default_rules()
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(rules, f, indent=2, ensure_ascii=False)
        
    print(f"Rules generated to {output_path}")

if __name__ == "__main__":
    main()

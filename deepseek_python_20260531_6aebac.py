import re
import numpy as np
from typing import List, Tuple, Dict

# Словарь маркеров для каждой фазы (можно расширять)
PHASE_MARKERS = {
    '∂₀': r'\b(начал[ао]|вспышк[ау]|импульс|вход|активац|запуск|инъекц|вброс|возник|появл|рожден|старт)\b',
    '≈':  r'\b(стабил|удержан|равновеси|покой|стационар|фиксац|задержк|пауз[ау]|нейтрал|баланс)\b',
    '↑⃗':  r'\b(ускор|увелич|нараста|рост|подъем|повыш|градиент|направлен|вектор|движени)\b',
    '⇄':  r'\b(переключ|смен[ау]|коммутац|бифуркац|переход|альтернатив|перелив|обратн|связь)\b',
    '⊗':  r'\b(сложени|смешени|конволюц|наслоен|одновремен|совмещен|комбинац|гармони|интеграц)\b',
    '↓':  r'\b(спад|затухан|расслаблен|диссипац|релаксац|уменьшен|снижен|уход|остыван|разрядк[ау])\b',
    '∞':  r'\b(фокусировк|концентрац|аттрактор|кристаллизац|финал|завершен|замыкан|память|схождени)\b'
}

def phase_score(sentence: str) -> Dict[str, float]:
    """Возвращает словарь вероятностей для каждой фазы (0..1)"""
    scores = {}
    for phase, pattern in PHASE_MARKERS.items():
        matches = re.findall(pattern, sentence, re.IGNORECASE)
        # Чем больше маркеров – тем выше сырой балл (но не более 1)
        raw = min(len(matches) * 0.3, 1.0)
        scores[phase] = raw
    # Если ни одного маркера – малая равномерная вероятность
    if max(scores.values()) == 0:
        scores = {p: 0.05 for p in PHASE_MARKERS}
    return scores

def smooth_scores(scores_sequence: List[Dict[str, float]], lambda_smooth: float = 0.3) -> List[Dict[str, float]]:
    """
    Предиктивное сглаживание (релаксация) – перемешивает оценки соседних предложений,
    имитируя минимизацию свободной энергии.
    """
    smoothed = []
    T = len(scores_sequence)
    for i in range(T):
        new_scores = {}
        for phase in PHASE_MARKERS:
            # соседние вклады
            neighbor_sum = 0.0
            if i > 0:
                neighbor_sum += scores_sequence[i-1][phase]
            if i < T-1:
                neighbor_sum += scores_sequence[i+1][phase]
            # взвешенное среднее: текущий (1 - λ) + соседи (λ/2 + λ/2)
            smoothed_val = (1 - lambda_smooth) * scores_sequence[i][phase] + (lambda_smooth / 2) * neighbor_sum
            new_scores[phase] = smoothed_val
        # нормировка (не обязательна, но для эстетики)
        total = sum(new_scores.values())
        if total > 0:
            new_scores = {p: v/total for p, v in new_scores.items()}
        smoothed.append(new_scores)
    return smoothed

def find_omega_arc(prob_matrix: List[Dict[str, float]]) -> List[Tuple[int, str]]:
    """
    Ищет наиболее вероятную последовательность из 7 фаз в порядке Ω.
    Возвращает список (индекс_предложения, фаза).
    """
    phases_order = ['∂₀','≈','↑⃗','⇄','⊗','↓','∞']
    # Жадный поиск: идём по тексту, назначаем фазу с максимальной вероятностью,
    # соблюдая порядок (не строго, а разрешая пропуски)
    result = []
    phase_idx = 0
    for i, probs in enumerate(prob_matrix):
        if phase_idx >= len(phases_order):
            break
        target_phase = phases_order[phase_idx]
        # Если вероятность целевой фазы выше порога или выше средней
        if probs[target_phase] > 0.2 or probs[target_phase] > max(probs.values()) - 0.1:
            result.append((i, target_phase))
            phase_idx += 1
    return result

def visualize_html(text: str, annotations: List[Tuple[int, str]], sentences: List[str]) -> str:
    """Создаёт HTML с цветной подсветкой фаз"""
    colors = {
        '∂₀': 'red', '≈': 'gray', '↑⃗': 'gold', '⇄': 'orange',
        '⊗': 'purple', '↓': 'green', '∞': 'blue'
    }
    # Размечаем предложения
    annotated_sentences = []
    for i, sent in enumerate(sentences):
        phase = None
        for idx, ph in annotations:
            if idx == i:
                phase = ph
                break
        if phase:
            color = colors.get(phase, 'black')
            annotated_sentences.append(f'<span style="background-color:{color}; color:white; padding:2px;">{phase}</span> {sent}')
        else:
            annotated_sentences.append(sent)
    html = f"""
    <html>
    <head><meta charset="UTF-8"><title>Ω-распознаватель</title></head>
    <body>
    <h1>Omega Pattern Recognition</h1>
    <p>Цвета: ∂₀ красный, ≈ серый, ↑⃗ золотой, ⇄ оранжевый, ⊗ фиолетовый, ↓ зелёный, ∞ синий</p>
    <div style="font-size:1.2em; line-height:1.5;">
        {'<br><br>'.join(annotated_sentences)}
    </div>
    </body>
    </html>
    """
    return html

# =========== ПРИМЕР ИСПОЛЬЗОВАНИЯ ===========
if __name__ == "__main__":
    sample_text = """
    Начался эксперимент. Система вошла в состояние равновесия. Затем мы заметили нарастание активности.
    Произошло переключение режима. Одновременно запустились два процесса. Спад напряжения прошёл успешно.
    В конце всё сфокусировалось на единственной точке. Стабилизация удержалась. Импульс повторился.
    """
    # Разбивка на предложения (упрощённо)
    sentences = re.split(r'(?<=[.!?])\s+', sample_text.strip())
    # Оценка фаз
    raw_scores = [phase_score(s) for s in sentences]
    # Сглаживание (релаксация)
    smoothed = smooth_scores(raw_scores, lambda_smooth=0.3)
    # Поиск Ω-дуги
    arc = find_omega_arc(smoothed)
    # Визуализация
    html_out = visualize_html(sample_text, arc, sentences)
    with open("omega_recognition.html", "w", encoding="utf-8") as f:
        f.write(html_out)
    print("Создан файл omega_recognition.html. Откройте его в браузере.")
    print("Найденные соответствия фаз:", arc)
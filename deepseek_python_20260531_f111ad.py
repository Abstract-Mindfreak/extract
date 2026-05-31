import numpy as np
from typing import List, Tuple, Dict, Any, Callable, Optional
from abc import ABC, abstractmethod
import copy

class Domain(ABC):
    """Абстрактный домен – пользователь наследует и реализует отображение в координаты."""
    
    @abstractmethod
    def embed(self, element: Any) -> np.ndarray:
        """
        Возвращает координаты (A, S, T, E) для элемента домена.
        Значения должны быть нормированы примерно в [0,1] для стабильной метрики.
        """
        pass
    
    def noise_profile(self, element: Any) -> float:
        """Ожидаемый квадрат шума (σ²) для элемента. По умолчанию 0.05."""
        return 0.05
    
    def operator_effect(self, op: str, elem_from: Any, elem_to: Any, t: float) -> np.ndarray:
        """
        Эмуляция применения оператора к переходу между элементами.
        По умолчанию – линейная интерполяция координат.
        Можно переопределить для специфических эффектов (нелинейность, память).
        t ∈ [0,1] – прогресс внутри фазы (опционально, для адаптивной плотности).
        """
        c1 = self.embed(elem_from)
        c2 = self.embed(elem_to)
        return (1 - t) * c1 + t * c2


class OmegaEngine:
    """
    Движок Omega Protocol v1.1 с полной поддержкой любых доменов.
    """
    
    def __init__(self,
                 weights: Dict[str, float] = None,
                 lambda_a5: float = 0.85,
                 d_max: float = 0.15,
                 max_correction_iter: int = 3):
        self.weights = weights or {'A': 0.15, 'S': 0.30, 'T': 0.25, 'E': 0.30}
        self.lambda_a5 = lambda_a5
        self.d_max = d_max
        self.max_correction_iter = max_correction_iter
        self.operators = ['∂₀', '≈', '↑⃗', '⇄', '⊗', '↓', '∞']
    
    def adaptive_density(self, sigma_sq: float) -> float:
        """A5: ρ = exp(-λ·σ²), ограничение [0.4, 1.0]"""
        rho = np.exp(-self.lambda_a5 * sigma_sq)
        return np.clip(rho, 0.4, 1.0)
    
    def compute_D(self, C_prev: np.ndarray, C_curr: np.ndarray,
                  sigma_avg: float, rho_min: float) -> float:
        """Метрика D с весами и стохастическим членом."""
        delta = C_curr - C_prev
        weighted_sq = sum(self.weights[k] * delta[i]**2 for i, k in enumerate(['A','S','T','E']))
        kappa = 0.12
        return np.sqrt(weighted_sq + kappa * sigma_avg**2) * (1.0 - rho_min)
    
    def correct_coordinate(self, coords_history: List[np.ndarray], idx: int) -> np.ndarray:
        """Коррекция (A2): перераспределение Δ по соседям."""
        if idx <= 0 or idx >= len(coords_history) - 1:
            return coords_history[idx]
        return (coords_history[idx-1] + coords_history[idx+1]) / 2
    
    def generate_sequence(self,
                          domain: Domain,
                          palette: List[Any],
                          R: int = 0,
                          max_depth: int = 5,
                          noise_override: Optional[List[float]] = None,
                          return_history: bool = False) -> Dict[str, Any]:
        """
        Основной генератор.
        - domain: экземпляр класса Domain
        - palette: список из ровно 7 элементов
        - R: текущая глубина рекурсии (не передавать вручную)
        - max_depth: максимальная глубина рекурсии
        - noise_override: список σ² для каждой фазы (длина 7), если None – берётся из domain.noise_profile()
        - return_history: если True, возвращает полную историю координат и D для каждой фазы
        """
        if len(palette) != 7:
            raise ValueError(f"Палитра должна содержать 7 элементов, получено {len(palette)}")
        
        # Инициализация
        coords = []
        states = []
        D_values = []
        corrections = 0
        
        # Начальное состояние
        current_elem = palette[0]
        current_coord = domain.embed(current_elem)
        coords.append(current_coord)
        states.append(current_elem)
        
        # Шумовой профиль
        if noise_override is None:
            sigma_sq_list = [domain.noise_profile(e) for e in palette]
        else:
            sigma_sq_list = noise_override
        
        # Проход по 7 операторам
        for phase_idx, op in enumerate(self.operators):
            next_elem = palette[(phase_idx + 1) % 7]  # циклически, но согласно шаблону
            # Применяем оператор (эмуляция перехода)
            # Для простоты используем operator_effect с t = 1 (конечная точка фазы)
            # В реальности адаптивная плотность меняет t, но для вычисления D берём конечную точку
            next_coord = domain.operator_effect(op, current_elem, next_elem, t=1.0)
            
            # A5: адаптивная плотность влияет на сглаживание перехода (здесь – усреднение при высоком шуме)
            sigma_sq = sigma_sq_list[phase_idx % 7]
            rho = self.adaptive_density(sigma_sq)
            if rho < 0.8:
                # Растянутый кроссфейд – результат ближе к среднему
                next_coord = (current_coord + next_coord) / 2
            
            # Вычисление метрики D
            sigma_avg = np.mean(sigma_sq_list)
            rho_min = min(self.adaptive_density(s) for s in sigma_sq_list)
            D = self.compute_D(current_coord, next_coord, sigma_avg, rho_min)
            D_values.append(D)
            
            # Самокоррекция ядра (P1,P2)
            iter_count = 0
            while D > self.d_max and iter_count < self.max_correction_iter:
                next_coord = self.correct_coordinate(coords + [next_coord], len(coords))
                D = self.compute_D(current_coord, next_coord, sigma_avg, rho_min)
                iter_count += 1
                corrections += 1
            
            # Запись
            coords.append(next_coord)
            states.append(next_elem)
            current_coord = next_coord
            current_elem = next_elem
        
        # Проверка A3: рекуррентное замыкание (терминал ⊂ выпуклой оболочки начальных)
        final_coord = coords[-1]
        hull_min = np.min(coords, axis=0)
        hull_max = np.max(coords, axis=0)
        inside_hull = np.all((final_coord >= hull_min) & (final_coord <= hull_max))
        stable = inside_hull and (D <= self.d_max)
        
        result = {
            'sequence': list(zip(self.operators, states[1:])),  # (оператор, элемент)
            'coordinates': np.array(coords),
            'D_sequence': D_values,
            'D_final': D_values[-1] if D_values else 0.0,
            'stability_flag': stable,
            'corrections_applied': corrections,
            'R': R,
            'palette': palette
        }
        
        # Рекурсия (извлечение инвариантов)
        if R < max_depth:
            # ExtractInvariants: новая палитра = последнее состояние + циклический сдвиг (упрощённо)
            # В более умной версии можно использовать собственные векторы координат
            new_palette = [states[-1]] + palette[:-1]  # терминал + первые 6 исходных
            recursive = self.generate_sequence(domain, new_palette, R+1, max_depth,
                                               noise_override, return_history)
            result['recursive'] = recursive
        
        if return_history:
            result['full_history'] = {'coords': coords, 'D': D_values}
        
        return result


# ========== ПРИМЕРЫ ДОМЕНОВ ==========

class PhoneticDomain(Domain):
    """Фонетический домен (ноты, слоги) с предопределёнными координатами."""
    def __init__(self):
        self.coord_map = {
            "Sa":  (0.20,0.45,0.60,0.35),
            "Do":  (0.25,0.50,0.55,0.40),
            "Re":  (0.30,0.55,0.65,0.45),
            "Ga":  (0.35,0.60,0.70,0.50),
            "Ma":  (0.40,0.70,0.75,0.55),
            "Pa":  (0.45,0.80,0.80,0.60),
            "Dha": (0.50,0.85,0.85,0.65)
        }
    
    def embed(self, element: str) -> np.ndarray:
        return np.array(self.coord_map.get(element, (0.5,0.5,0.5,0.5)))
    
    def noise_profile(self, element: str) -> float:
        return 0.02  # низкий шум


class AffectiveDomain(Domain):
    """Аффективный домен (эмоциональные состояния)."""
    def embed(self, element: str) -> np.ndarray:
        # Элементы: ∅₀, ↔₁, ↗₂, ⌁₃, ⧉₄, ↘₅, ⊚₆
        states = {
            "∅₀": (0.1, 0.2, 0.3, 0.2),   # нейтральный фон
            "↔₁": (0.2, 0.3, 0.4, 0.3),   # амбивалентность
            "↗₂": (0.5, 0.4, 0.6, 0.5),   # восходящее напряжение
            "⌁₃": (0.6, 0.6, 0.5, 0.7),   # бифуркация
            "⧉₄": (0.8, 0.7, 0.6, 0.9),   # полиаффект
            "↘₅": (0.4, 0.8, 0.3, 0.6),   # катарсис
            "⊚₆": (0.3, 0.5, 0.8, 0.4)    # циклическая фиксация
        }
        return np.array(states.get(element, (0.5,0.5,0.5,0.5)))
    
    def noise_profile(self, element: str) -> float:
        return 0.1  # средний шум


class StockMarketDomain(Domain):
    """Финансовый домен – свечи OHLC превращаем в (A,S,T,E)."""
    def embed(self, candle: Dict[str, float]) -> np.ndarray:
        # candle = {'open':o,'high':h,'low':l,'close':c,'volume':v}
        # A – амплитуда (high-low)/close
        # S – спектральная плотность = объём / (high-low+eps)
        # T – временнáя инерция = (close-open)/(high-low+eps)
        # E – эмотивный импульс = close/open
        o,h,l,c,v = candle['open'], candle['high'], candle['low'], candle['close'], candle['volume']
        amp = (h - l) / c if c!=0 else 0.05
        spread = max(h-l, 0.001)
        spectral = v / spread
        T = (c - o) / spread
        E = c / o if o!=0 else 1.0
        # Нормализация в примерный диапазон [0,1] (пользователь должен масштабировать под свой рынок)
        return np.array([amp, spectral/1000, T, E])  # упрощённо
    
    def noise_profile(self, candle: Dict[str, float]) -> float:
        return 0.2  # высокий шум


# ========== ДЕМОНСТРАЦИЯ ==========
if __name__ == "__main__":
    engine = OmegaEngine()
    
    # 1. Фонетика
    phonetic = PhoneticDomain()
    palette_phon = ["Sa","Do","Re","Ga","Ma","Pa","Dha"]
    res1 = engine.generate_sequence(phonetic, palette_phon, max_depth=2)
    print("=== Фонетический домен ===")
    print(f"D_final = {res1['D_final']:.4f}, Stable = {res1['stability_flag']}, Corrections = {res1['corrections_applied']}")
    print(f"Последовательность: {res1['sequence']}\n")
    
    # 2. Аффективный
    affect = AffectiveDomain()
    palette_aff = ["∅₀","↔₁","↗₂","⌁₃","⧉₄","↘₅","⊚₆"]
    res2 = engine.generate_sequence(affect, palette_aff, max_depth=1)
    print("=== Аффективный домен ===")
    print(f"D_final = {res2['D_final']:.4f}, Stable = {res2['stability_flag']}\n")
    
    # 3. Финансовый – синтетические данные
    # Генерируем 7 последовательных свечей
    import random
    synthetic_candles = []
    base = 100.0
    for i in range(7):
        o = base + random.uniform(-1,1)
        c = o + random.uniform(-2,2)
        h = max(o,c) + abs(random.gauss(0,0.5))
        l = min(o,c) - abs(random.gauss(0,0.5))
        v = random.randint(1000,10000)
        synthetic_candles.append({'open':o,'high':h,'low':l,'close':c,'volume':v})
        base = c
    market = StockMarketDomain()
    res3 = engine.generate_sequence(market, synthetic_candles, max_depth=0)
    print("=== Финансовый домен ===")
    print(f"D_final = {res3['D_final']:.4f}, Stable = {res3['stability_flag']}, Corrections = {res3['corrections_applied']}")
    print("Координаты первой свечи (A,S,T,E):", market.embed(synthetic_candles[0]))
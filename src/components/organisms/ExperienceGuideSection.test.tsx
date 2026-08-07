import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExperienceGuideSection } from '@/components/organisms/ExperienceGuideSection';
import type { ExperienceGuide } from '@/domain/experience-guide';

// ---------------------------------------------------------------------------
// Dados de teste
// ---------------------------------------------------------------------------

const fakeGuide: ExperienceGuide = {
  welcome_message: 'Bem-vindo a Florianópolis!',
  restaurants: [
    { name: 'Restaurante A', distance: 'Aprox. 1 km', description: 'Comida italiana.' },
    { name: 'Restaurante B', distance: 'Aprox. 2 km', description: 'Frutos do mar.' },
    { name: 'Restaurante C', distance: 'Aprox. 3 km', description: 'Comida brasileira.' },
    { name: 'Restaurante D', distance: 'Aprox. 4 km', description: 'Café colonial.' },
  ],
  attractions: [
    { name: 'Praia A', distance: 'Aprox. 5 km', description: 'Praia bonita.' },
    { name: 'Mirante B', distance: 'Aprox. 6 km', description: 'Vista panorâmica.' },
    { name: 'Parque C', distance: 'Aprox. 7 km', description: 'Natureza.' },
  ],
  essentials: [
    {
      name: 'Farmácia 24h',
      distance: 'Aprox. 500 m',
      description: 'Farmácia.',
      type: 'pharmacy',
    },
  ],
  seasonal_tip: 'Leve protetor solar.',
};

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe('ExperienceGuideSection', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mostra o estado de carregamento antes da resposta', () => {
    // Promise que nunca resolve → loading permanece
    mockFetch.mockReturnValue(new Promise(() => {}));

    render(<ExperienceGuideSection code="FLN001" />);

    expect(
      screen.getByText(/Estamos preparando recomendações/),
    ).toBeInTheDocument();
  });

  it('mostra os lugares quando a resposta chega', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ guide: fakeGuide }),
    });

    render(<ExperienceGuideSection code="FLN001" />);

    await waitFor(() => {
      expect(
        screen.getByText('Bem-vindo a Florianópolis!'),
      ).toBeInTheDocument();
    });

    expect(screen.getByText('Restaurante A')).toBeInTheDocument();
    expect(screen.getByText('Praia A')).toBeInTheDocument();
    expect(screen.getByText('Farmácia 24h')).toBeInTheDocument();
    expect(screen.getByText('Leve protetor solar.')).toBeInTheDocument();
  });

  it('mostra mensagem de erro e botão de tentar novamente quando a resposta é erro', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'Falha ao gerar guia.' } }),
    });

    render(<ExperienceGuideSection code="FLN001" />);

    await waitFor(() => {
      expect(screen.getByText('Falha ao gerar guia.')).toBeInTheDocument();
    });

    expect(screen.getByText('Tentar novamente')).toBeInTheDocument();
  });

  it('clique em tentar novamente refaz o fetch', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: 'Erro na primeira.' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ guide: fakeGuide }),
      });

    render(<ExperienceGuideSection code="FLN001" />);

    await waitFor(() => {
      expect(screen.getByText('Erro na primeira.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Tentar novamente'));

    await waitFor(() => {
      expect(
        screen.getByText('Bem-vindo a Florianópolis!'),
      ).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

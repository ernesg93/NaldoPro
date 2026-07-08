// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockShare = vi.fn();

vi.mock('../hooks/useWebShare', () => ({
  useWebShare: () => ({
    share: mockShare,
    loading: false,
    result: null,
    reset: vi.fn(),
  }),
  isUserCancel: vi.fn(),
  sharePublication: vi.fn(),
}));

vi.mock('../services/CampaignService', () => ({
  CampaignService: {
    getCampaign: vi.fn(),
    getCampaignProducts: vi.fn(),
    getGeneratedPublications: vi.fn(),
    updateCampaignProductStatus: vi.fn(),
    updateCampaignStatus: vi.fn(),
  },
}));

vi.mock('../services/ProductService', () => ({
  ProductService: {
    getProducts: vi.fn(),
  },
}));

vi.mock('../lib/firebase', () => ({ db: {} }));

const IMAGE_URL = 'https://res.cloudinary.com/demo/image/upload/v1/pub.png';
const SAMPLE_TEXT = 'Oferta especial — 50% descuento';

async function setupCampaignShare(
  overrides?: Record<string, unknown>,
) {
  const { CampaignService } = await import('../services/CampaignService');
  const { ProductService } = await import('../services/ProductService');
  const mod = await import('../pages/CampaignShare');

  vi.mocked(CampaignService.getCampaign).mockResolvedValue({
    id: 'camp-1',
    nombre: 'Test Campaign',
    estado: 'generada',
    fecha_creacion: new Date(),
    tasa_usada: 405,
    ...overrides,
  });
  vi.mocked(CampaignService.getCampaignProducts).mockResolvedValue([
    {
      id: 'cp-1',
      campaña_id: 'camp-1',
      producto_id: 'prod-1',
      orden: 1,
      usar_precio_manual: false,
      estado_envio: 'pendiente' as const,
    },
  ]);
  vi.mocked(CampaignService.getGeneratedPublications).mockResolvedValue([
    {
      id: 'pub-1',
      campaña_id: 'camp-1',
      campaña_producto_id: 'cp-1',
      texto_generado: SAMPLE_TEXT,
      imagen_url: IMAGE_URL,
      precio_unitario_final_cup: 855,
      precio_caja_cup: 17100,
      cantidad_por_caja: 20,
    },
  ]);
  vi.mocked(ProductService.getProducts).mockResolvedValue([
    {
      id: 'prod-1',
      nombre: 'Test Product',
      categoria_id: 'cat-1',
      imagen_url: 'https://example.com/img.png',
      precio_usd: 10,
      cantidad_por_caja: 20,
      estado: 'activo' as const,
      created_at: new Date(),
      updated_at: new Date(),
    },
  ]);

  return mod.CampaignShare;
}

describe('CampaignShare sent-status rule', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockShare.mockReset();
  });

  // ---------- 2.8.1 shared → updateCampaignProductStatus called ----------
  it('calls updateCampaignProductStatus on shared result', async () => {
    mockShare.mockResolvedValue({
      status: 'shared',
      channel: 'native',
    });

    const { CampaignService } = await import('../services/CampaignService');
    const CampaignShare = await setupCampaignShare();

    render(
      <MemoryRouter initialEntries={['/campaigns/camp-1/share']}>
        <Routes>
          <Route path="/campaigns/:id/share" element={<CampaignShare />} />
        </Routes>
      </MemoryRouter>,
    );

    // Wait for data to load
    expect(await screen.findByText(/Test Campaign/)).toBeInTheDocument();

    // Click the share button
    const shareBtn = screen.getByRole('button', { name: /compartir/i });
    await userEvent.click(shareBtn);

    // Wait for async share to resolve
    await vi.waitFor(() => {
      expect(
        CampaignService.updateCampaignProductStatus,
      ).toHaveBeenCalledWith('cp-1', 'enviado');
    });
  });

  // ---------- 2.8.2 fallback-shared → updateCampaignProductStatus called ----------
  it('calls updateCampaignProductStatus on fallback-shared result', async () => {
    mockShare.mockResolvedValue({
      status: 'fallback-shared',
      copied: true,
      imageAction: 'downloaded' as const,
    });

    const { CampaignService } = await import('../services/CampaignService');
    const CampaignShare = await setupCampaignShare();

    render(
      <MemoryRouter initialEntries={['/campaigns/camp-1/share']}>
        <Routes>
          <Route path="/campaigns/:id/share" element={<CampaignShare />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Test Campaign/)).toBeInTheDocument();

    const shareBtn = screen.getByRole('button', { name: /compartir/i });
    await userEvent.click(shareBtn);

    await vi.waitFor(() => {
      expect(
        CampaignService.updateCampaignProductStatus,
      ).toHaveBeenCalledWith('cp-1', 'enviado');
    });
  });

  // ---------- 2.8.3 canceled → NOT call updateCampaignProductStatus ----------
  it('does NOT call updateCampaignProductStatus on canceled result', async () => {
    mockShare.mockResolvedValue({ status: 'canceled' });

    const { CampaignService } = await import('../services/CampaignService');
    const CampaignShare = await setupCampaignShare();

    render(
      <MemoryRouter initialEntries={['/campaigns/camp-1/share']}>
        <Routes>
          <Route path="/campaigns/:id/share" element={<CampaignShare />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Test Campaign/)).toBeInTheDocument();

    const shareBtn = screen.getByRole('button', { name: /compartir/i });
    await userEvent.click(shareBtn);

    // Small delay to allow any async work
    await vi.waitFor(() => {
      expect(mockShare).toHaveBeenCalledTimes(1);
    });
    expect(
      CampaignService.updateCampaignProductStatus,
    ).not.toHaveBeenCalled();
  });

  // ---------- 2.8.4 failed → NOT call updateCampaignProductStatus ----------
  it('does NOT call updateCampaignProductStatus on failed result', async () => {
    mockShare.mockResolvedValue({
      status: 'failed',
      reason: 'Something went wrong',
    });

    const { CampaignService } = await import('../services/CampaignService');
    const CampaignShare = await setupCampaignShare();

    render(
      <MemoryRouter initialEntries={['/campaigns/camp-1/share']}>
        <Routes>
          <Route path="/campaigns/:id/share" element={<CampaignShare />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Test Campaign/)).toBeInTheDocument();

    const shareBtn = screen.getByRole('button', { name: /compartir/i });
    await userEvent.click(shareBtn);

    await vi.waitFor(() => {
      expect(mockShare).toHaveBeenCalledTimes(1);
    });
    expect(
      CampaignService.updateCampaignProductStatus,
    ).not.toHaveBeenCalled();
  });

  // ---------- 3.5 Success/failure feedback notices ----------
  it('shows a success notice after a successful share', async () => {
    mockShare.mockResolvedValue({
      status: 'shared',
      channel: 'native',
    });

    const CampaignShare = await setupCampaignShare();

    render(
      <MemoryRouter initialEntries={['/campaigns/camp-1/share']}>
        <Routes>
          <Route path="/campaigns/:id/share" element={<CampaignShare />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Test Campaign/)).toBeInTheDocument();

    const shareBtn = screen.getByRole('button', { name: /compartir/i });
    await userEvent.click(shareBtn);

    expect(
      await screen.findByText(/publicación enviada/i),
    ).toBeInTheDocument();
  });

  it('shows a success notice after fallback-shared with copy', async () => {
    mockShare.mockResolvedValue({
      status: 'fallback-shared',
      copied: true,
      imageAction: 'downloaded' as const,
    });

    const CampaignShare = await setupCampaignShare();

    render(
      <MemoryRouter initialEntries={['/campaigns/camp-1/share']}>
        <Routes>
          <Route path="/campaigns/:id/share" element={<CampaignShare />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Test Campaign/)).toBeInTheDocument();

    const shareBtn = screen.getByRole('button', { name: /compartir/i });
    await userEvent.click(shareBtn);

    expect(
      await screen.findByText(/texto copiado/i),
    ).toBeInTheDocument();
  });

  it('shows a notice for canceled share', async () => {
    mockShare.mockResolvedValue({ status: 'canceled' });

    const CampaignShare = await setupCampaignShare();

    render(
      <MemoryRouter initialEntries={['/campaigns/camp-1/share']}>
        <Routes>
          <Route path="/campaigns/:id/share" element={<CampaignShare />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Test Campaign/)).toBeInTheDocument();

    const shareBtn = screen.getByRole('button', { name: /compartir/i });
    await userEvent.click(shareBtn);

    expect(
      await screen.findByText(/compartir cancelado/i),
    ).toBeInTheDocument();
  });

  it('does NOT mark as sent when all fallbacks fail (copied=false, imageAction=failed => status=failed)', async () => {
    // Simulates the sharePublication() behavior when both clipboard AND image fail
    mockShare.mockResolvedValue({
      status: 'failed',
      reason: 'No se pudo copiar el texto ni acceder a la imagen.',
    });

    const { CampaignService } = await import('../services/CampaignService');
    const CampaignShare = await setupCampaignShare();

    render(
      <MemoryRouter initialEntries={['/campaigns/camp-1/share']}>
        <Routes>
          <Route path="/campaigns/:id/share" element={<CampaignShare />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Test Campaign/)).toBeInTheDocument();

    const shareBtn = screen.getByRole('button', { name: /compartir/i });
    await userEvent.click(shareBtn);

    // Must show failure notice with specific reason
    expect(
      await screen.findByText(/No se pudo copiar el texto/i),
    ).toBeInTheDocument();

    // Must NOT mark as sent
    expect(
      CampaignService.updateCampaignProductStatus,
    ).not.toHaveBeenCalled();

    // Must NOT appear as "Enviada"
    expect(screen.queryByText(/enviada/i)).not.toBeInTheDocument();
  });

  it('shows a failure notice for failed share', async () => {
    mockShare.mockResolvedValue({
      status: 'failed',
      reason: 'Clipboard blocked',
    });

    const CampaignShare = await setupCampaignShare();

    render(
      <MemoryRouter initialEntries={['/campaigns/camp-1/share']}>
        <Routes>
          <Route path="/campaigns/:id/share" element={<CampaignShare />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Test Campaign/)).toBeInTheDocument();

    const shareBtn = screen.getByRole('button', { name: /compartir/i });
    await userEvent.click(shareBtn);

    expect(
      await screen.findByText(/error/i),
    ).toBeInTheDocument();
  });

  it('shows image failure context when copied succeeds but imageAction fails', async () => {
    mockShare.mockResolvedValue({
      status: 'fallback-shared',
      copied: true,
      imageAction: 'failed' as const,
    });

    const CampaignShare = await setupCampaignShare();

    render(
      <MemoryRouter initialEntries={['/campaigns/camp-1/share']}>
        <Routes>
          <Route path="/campaigns/:id/share" element={<CampaignShare />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Test Campaign/)).toBeInTheDocument();

    const shareBtn = screen.getByRole('button', { name: /compartir/i });
    await userEvent.click(shareBtn);

    // Must acknowledge the image failure, not claim "imagen abierta"
    expect(
      await screen.findByText(/no se pudo acceder a la imagen/i),
    ).toBeInTheDocument();
    // Must NOT claim the image was opened
    expect(
      screen.queryByText(/imagen abierta/i),
    ).not.toBeInTheDocument();
  });

  it('shows a partial notice for fallback with clipboard failure', async () => {
    mockShare.mockResolvedValue({
      status: 'fallback-shared',
      copied: false,
      imageAction: 'opened' as const,
    });

    const CampaignShare = await setupCampaignShare();

    render(
      <MemoryRouter initialEntries={['/campaigns/camp-1/share']}>
        <Routes>
          <Route path="/campaigns/:id/share" element={<CampaignShare />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Test Campaign/)).toBeInTheDocument();

    const shareBtn = screen.getByRole('button', { name: /compartir/i });
    await userEvent.click(shareBtn);

    // Should show some result notice
    expect(
      await screen.findByText(/no se pudo copiar el texto/i),
    ).toBeInTheDocument();
  });

  // ---------- Blocker 2: fallback-shared with copied=false must NOT mark sent ----------
  it('does NOT call updateCampaignProductStatus when fallback-shared with copied=false and imageAction=opened', async () => {
    mockShare.mockResolvedValue({
      status: 'fallback-shared',
      copied: false,
      imageAction: 'opened' as const,
    });

    const { CampaignService } = await import('../services/CampaignService');
    const CampaignShare = await setupCampaignShare();

    render(
      <MemoryRouter initialEntries={['/campaigns/camp-1/share']}>
        <Routes>
          <Route path="/campaigns/:id/share" element={<CampaignShare />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Test Campaign/)).toBeInTheDocument();

    const shareBtn = screen.getByRole('button', { name: /compartir/i });
    await userEvent.click(shareBtn);

    await vi.waitFor(() => {
      expect(mockShare).toHaveBeenCalledTimes(1);
    });

    // copied=false means no text was available to the user → should NOT mark sent
    expect(
      CampaignService.updateCampaignProductStatus,
    ).not.toHaveBeenCalled();
  });

  // ---------- Blocker 2 boundary: fallback-shared with copied=true MUST mark sent ----------
  it('DOES call updateCampaignProductStatus when fallback-shared with copied=true even if imageAction=opened', async () => {
    mockShare.mockResolvedValue({
      status: 'fallback-shared',
      copied: true,
      imageAction: 'opened' as const,
    });

    const { CampaignService } = await import('../services/CampaignService');
    const CampaignShare = await setupCampaignShare();

    render(
      <MemoryRouter initialEntries={['/campaigns/camp-1/share']}>
        <Routes>
          <Route path="/campaigns/:id/share" element={<CampaignShare />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Test Campaign/)).toBeInTheDocument();

    const shareBtn = screen.getByRole('button', { name: /compartir/i });
    await userEvent.click(shareBtn);

    await vi.waitFor(() => {
      expect(
        CampaignService.updateCampaignProductStatus,
      ).toHaveBeenCalledWith('cp-1', 'enviado');
    });
  });

  // ---------- Blocker 4: persistence failure shows recovery feedback ----------
  it('shows failure/recovery notice when updateCampaignProductStatus rejects after shared result', async () => {
    mockShare.mockResolvedValue({
      status: 'shared',
      channel: 'native',
    });

    const { CampaignService } = await import('../services/CampaignService');
    vi.mocked(CampaignService.updateCampaignProductStatus).mockRejectedValue(
      new Error('Firestore write failed'),
    );

    const CampaignShare = await setupCampaignShare();

    render(
      <MemoryRouter initialEntries={['/campaigns/camp-1/share']}>
        <Routes>
          <Route path="/campaigns/:id/share" element={<CampaignShare />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Test Campaign/)).toBeInTheDocument();

    const shareBtn = screen.getByRole('button', { name: /compartir/i });
    await userEvent.click(shareBtn);

    // Must show an error/recovery notice — NOT the success "publicación enviada"
    await vi.waitFor(() => {
      expect(
        screen.queryByText(/publicación enviada/i),
      ).not.toBeInTheDocument();
    });

    // Must show a recovery-oriented message
    expect(
      await screen.findByText(/marca manualmente/i, {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    // Or at least some error indication about sync failure
    expect(
      await screen.findByText(/error/i, {}, { timeout: 3000 }),
    ).toBeInTheDocument();
  });

  // ---------- Manual marcar still works ----------
  it('preserves manual Mark as Sent button', async () => {
    const CampaignShare = await setupCampaignShare();

    render(
      <MemoryRouter initialEntries={['/campaigns/camp-1/share']}>
        <Routes>
          <Route path="/campaigns/:id/share" element={<CampaignShare />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Test Campaign/)).toBeInTheDocument();

    const markBtn = screen.getByRole('button', { name: /marcar/i });
    expect(markBtn).toBeInTheDocument();
  });

  // ---------- Fix 4: title/fileName passed to share ----------
  it('passes title and fileName derived from campaign/product data to the share function', async () => {
    mockShare.mockResolvedValue({
      status: 'shared',
      channel: 'native',
    });

    const CampaignShare = await setupCampaignShare();

    render(
      <MemoryRouter initialEntries={['/campaigns/camp-1/share']}>
        <Routes>
          <Route path="/campaigns/:id/share" element={<CampaignShare />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Test Campaign/)).toBeInTheDocument();

    const shareBtn = screen.getByRole('button', { name: /compartir/i });
    await userEvent.click(shareBtn);

    await vi.waitFor(() => {
      expect(mockShare).toHaveBeenCalledTimes(1);
    });

    const shareArgs = mockShare.mock.calls[0][0];
    expect(shareArgs).toHaveProperty('title');
    expect(shareArgs).toHaveProperty('fileName');
    expect(shareArgs.title).toBe('Test Campaign - Test Product');
    expect(shareArgs.fileName).toBe('pub.png');
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, within, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────

vi.mock('../services/AuthService', () => ({
  AuthService: { logout: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../lib/firebase', () => ({ auth: {} }));

vi.mock('../services/ProductService', () => ({
  ProductService: {
    getProducts: vi.fn().mockResolvedValue([]),
    getProduct: vi.fn().mockResolvedValue(null),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
  },
}));

vi.mock('../services/CategoryService', () => ({
  CategoryService: {
    getCategories: vi.fn().mockResolvedValue([]),
    seedInitialCategories: vi.fn(),
  },
}));

vi.mock('../services/CampaignService', () => ({
  CampaignService: {
    getCampaigns: vi.fn().mockResolvedValue([]),
    getCampaign: vi.fn().mockResolvedValue(null),
    getCampaignProducts: vi.fn().mockResolvedValue([]),
    createCampaign: vi.fn(),
    updateCampaignProducts: vi.fn(),
    saveGeneration: vi.fn(),
  },
}));

vi.mock('../services/TemplateService', () => ({
  TemplateService: {
    getDefaultTemplate: vi.fn().mockResolvedValue({
      id: 'tpl-1',
      nombre: 'Default Template',
      contenido: '',
    }),
    getTemplateBlocks: vi.fn().mockResolvedValue([]),
    updateTemplateBlocks: vi.fn(),
  },
}));

vi.mock('../services/SettingsService', () => ({
  SettingsService: {
    getConfiguracion: vi.fn().mockResolvedValue({
      tasa_usd_cup: 120,
      redondeo_multiplo: 5,
      whatsapp_numero: '+5312345678',
      plantilla_default_id: 'tpl-1',
    }),
    initializeDefaultConfig: vi.fn(),
    updateConfiguracion: vi.fn(),
  },
  DEFAULT_CONFIG: {
    tasa_usd_cup: 120,
    redondeo_multiplo: 5,
    whatsapp_numero: '',
    plantilla_default_id: 'default-template',
  },
}));

vi.mock('../services/VariantService', () => ({
  VariantService: {
    getVariantTypes: vi.fn().mockResolvedValue([]),
    getVariantValues: vi.fn().mockResolvedValue([]),
    getSelectedValueIds: vi.fn().mockResolvedValue({}),
    saveProductVariants: vi.fn(),
    seedInitialVariantData: vi.fn(),
  },
}));

vi.mock('../services/ContentBlockService', () => ({
  ContentBlockService: {
    getContentBlocksWithItems: vi.fn().mockResolvedValue([]),
    saveContentBlocks: vi.fn(),
  },
}));

vi.mock('../services/StorageService', () => ({
  StorageService: {
    uploadImage: vi.fn().mockResolvedValue('https://example.com/img.jpg'),
  },
}));

vi.mock('../services/RenderService', () => ({
  RenderService: {
    generatePublications: vi.fn().mockReturnValue([]),
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────

function renderWithRouter(ui: React.ReactElement, initialEntries: string[] = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      {ui}
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
});

/** Render a component inside a Route so useParams works */
function renderWithRoute(ui: React.ReactElement, path: string, routePath = '*') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={routePath} element={ui} />
      </Routes>
    </MemoryRouter>
  );
}

// ─── Catalog ─────────────────────────────────────────────────────────────

describe('Catalog page structure (PR2 reflow guard)', () => {
  it('renders the page header with title and create button', async () => {
    const { Catalog } = await import('../pages/Catalog');
    renderWithRouter(<Catalog />);

    expect(await screen.findByRole('heading', { name: /catálogo/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /nuevo producto/i })).toBeInTheDocument();
  });

  it('renders search and filter controls', async () => {
    const { Catalog } = await import('../pages/Catalog');
    renderWithRouter(<Catalog />);

    await screen.findByText(/No se encontraron productos/);
    expect(screen.getByPlaceholderText(/buscar producto/i)).toBeInTheDocument();
  });

  it('renders product list container with empty state', async () => {
    const { Catalog } = await import('../pages/Catalog');
    renderWithRouter(<Catalog />);

    await screen.findByText(/No se encontraron productos/);
    expect(screen.getByText(/No se encontraron productos/).closest('div')).toBeInTheDocument();
  });
});

describe('Catalog responsive contracts (PR2 regression guards)', () => {
  it('page header uses responsive flex-col sm:flex-row pattern', async () => {
    const { Catalog } = await import('../pages/Catalog');
    renderWithRouter(<Catalog />);

    await screen.findByText(/No se encontraron productos/);
    // The header row with title + create button uses responsive layout
    const heading = screen.getByRole('heading', { name: /catálogo/i });
    const headerRow = heading.closest('div')?.parentElement;
    expect(headerRow?.className).toContain('flex-col');
    expect(headerRow?.className).toContain('sm:flex-row');
  });

  it('product status is visible in DOM (not hidden)', async () => {
    const { Catalog } = await import('../pages/Catalog');
    // Mock products with a status to verify it renders
    const { ProductService } = await import('../services/ProductService');
    const mockGet = vi.mocked(ProductService.getProducts);
    mockGet.mockResolvedValueOnce([
      {
        id: 'p1',
        nombre: 'Test Product',
        categoria_id: 'cat1',
        imagen_url: 'https://example.com/img.jpg',
        precio_usd: 10,
        cantidad_por_caja: 1,
        estado: 'activo',
        marca: null,
      } as any,
    ]);
    const { CategoryService } = await import('../services/CategoryService');
    vi.mocked(CategoryService.getCategories).mockResolvedValueOnce([
      { id: 'cat1', nombre: 'Test Category' } as any,
    ]);

    renderWithRouter(<Catalog />);

    // Status badge should be visible (not hidden by display:none)
    const statusBadge = await screen.findByText('activo');
    expect(statusBadge).toBeInTheDocument();
    // Verify it's NOT hidden — check parent does not have "hidden" class
    const badgeContainer = statusBadge.closest('div');
    expect(badgeContainer?.className).not.toMatch(/\bhidden\b/);
  });
});

// ─── CampaignEditor ──────────────────────────────────────────────────────

describe('CampaignEditor page structure (PR2 reflow guard)', () => {
  it('renders loading state before resolving', async () => {
    const { CampaignEditor } = await import('../pages/CampaignEditor');
    renderWithRouter(<CampaignEditor />);

    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('resolves to not-found when campaign does not exist', async () => {
    const { CampaignEditor } = await import('../pages/CampaignEditor');
    renderWithRoute(<CampaignEditor />, '/campaigns/nonexistent-id', '/campaigns/:id');

    await waitFor(() => {
      expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument();
    }, { timeout: 5000 });
  });
});

describe('CampaignEditor responsive contracts (PR2 regression guards)', () => {
  it('primary actions have min-h-11 touch target class', async () => {
    const { CampaignEditor } = await import('../pages/CampaignEditor');
    // Set up campaign data so the editor renders fully
    const { CampaignService } = await import('../services/CampaignService');
    vi.mocked(CampaignService.getCampaign).mockResolvedValueOnce({
      id: 'c1',
      nombre: 'Test Campaign',
      estado: 'borrador',
      tasa_usada: 120,
      fecha_creacion: new Date(),
    } as any);
    vi.mocked(CampaignService.getCampaignProducts).mockResolvedValueOnce([]);
    const { ProductService } = await import('../services/ProductService');
    vi.mocked(ProductService.getProducts).mockResolvedValueOnce([]);

    renderWithRoute(<CampaignEditor />, '/campaigns/c1', '/campaigns/:id');

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument();
    }, { timeout: 5000 });

    // Save button must have min-h-11
    const saveBtn = screen.getByRole('button', { name: /guardar/i });
    expect(saveBtn.className).toContain('min-h-11');

    // Generate button must have min-h-11
    const generateBtn = screen.getByRole('button', { name: /generar/i });
    expect(generateBtn.className).toContain('min-h-11');
  });

  it('share button has min-h-11 touch target when visible', async () => {
    const { CampaignEditor } = await import('../pages/CampaignEditor');
    const { CampaignService } = await import('../services/CampaignService');
    vi.mocked(CampaignService.getCampaign).mockResolvedValueOnce({
      id: 'c1',
      nombre: 'Test Campaign',
      estado: 'generada',
      tasa_usada: 120,
      fecha_creacion: new Date(),
    } as any);
    vi.mocked(CampaignService.getCampaignProducts).mockResolvedValueOnce([]);
    const { ProductService } = await import('../services/ProductService');
    vi.mocked(ProductService.getProducts).mockResolvedValueOnce([]);

    renderWithRoute(<CampaignEditor />, '/campaigns/c1', '/campaigns/:id');

    await waitFor(() => {
      expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument();
    }, { timeout: 5000 });

    // Share button visible when estado is 'generada' (not 'borrador')
    const shareBtn = screen.getByRole('button', { name: /compartir/i });
    expect(shareBtn.className).toContain('min-h-11');
  });

  it('icon-only buttons have accessible names', async () => {
    const { CampaignEditor } = await import('../pages/CampaignEditor');
    const { CampaignService } = await import('../services/CampaignService');
    vi.mocked(CampaignService.getCampaign).mockResolvedValueOnce({
      id: 'c1',
      nombre: 'Test Campaign',
      estado: 'borrador',
      tasa_usada: 120,
      fecha_creacion: new Date(),
    } as any);
    vi.mocked(CampaignService.getCampaignProducts).mockResolvedValueOnce([]);
    const { ProductService } = await import('../services/ProductService');
    vi.mocked(ProductService.getProducts).mockResolvedValueOnce([
      { id: 'p1', nombre: 'Prod', precio_usd: 5, imagen_url: '', estado: 'activo' } as any,
    ]);

    renderWithRoute(<CampaignEditor />, '/campaigns/c1', '/campaigns/:id');

    await waitFor(() => {
      expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument();
    }, { timeout: 5000 });

    // Add product button must have aria-label (not just title)
    const addBtn = screen.getByRole('button', { name: /agregar a campaña/i });
    expect(addBtn).toBeInTheDocument();
  });
});

// ─── TemplateEditor ──────────────────────────────────────────────────────

describe('TemplateEditor page structure (PR2 reflow guard)', () => {
  it('renders the template heading and save button', async () => {
    const { TemplateEditor } = await import('../pages/TemplateEditor');
    renderWithRouter(<TemplateEditor />);

    expect(await screen.findByRole('heading', { name: /plantilla comercial/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeInTheDocument();
  });

  it('renders the add block button', async () => {
    const { TemplateEditor } = await import('../pages/TemplateEditor');
    renderWithRouter(<TemplateEditor />);

    await screen.findByRole('heading', { name: /plantilla comercial/i });
    expect(screen.getByRole('button', { name: /agregar nuevo bloque/i })).toBeInTheDocument();
  });
});

describe('TemplateEditor responsive contracts (PR2 regression guards)', () => {
  it('save button has min-h-11 touch target', async () => {
    const { TemplateEditor } = await import('../pages/TemplateEditor');
    renderWithRouter(<TemplateEditor />);

    await screen.findByRole('heading', { name: /plantilla comercial/i });
    const saveBtn = screen.getByRole('button', { name: /guardar cambios/i });
    expect(saveBtn.className).toContain('min-h-11');
  });

  it('block inner controls use responsive flex-col sm:flex-row pattern', async () => {
    const { TemplateEditor } = await import('../pages/TemplateEditor');
    const { TemplateService } = await import('../services/TemplateService');
    // Provide blocks so the inner controls render
    vi.mocked(TemplateService.getTemplateBlocks).mockResolvedValueOnce([
      {
        id: 'b1',
        plantilla_id: 'tpl-1',
        tipo: 'texto',
        titulo: 'Test Block',
        orden: 1,
        visible: true,
        contenido: 'Hello',
      } as any,
    ]);

    renderWithRouter(<TemplateEditor />);

    await screen.findByRole('heading', { name: /plantilla comercial/i });

    // The block's inner controls wrapper should have responsive flex pattern
    // The select isn't associated via 'for', so query by role and navigate up
    const blockTypeSelect = screen.getAllByRole('combobox')[0];
    // go up: select → div (w-full sm:w-1/3) → div (flex flex-col sm:flex-row)
    const controlsRow = blockTypeSelect.closest('div')?.parentElement;
    expect(controlsRow?.className).toContain('flex-col');
    expect(controlsRow?.className).toContain('sm:flex-row');
  });

  it('block delete button has aria-label', async () => {
    const { TemplateEditor } = await import('../pages/TemplateEditor');
    const { TemplateService } = await import('../services/TemplateService');
    vi.mocked(TemplateService.getTemplateBlocks).mockResolvedValueOnce([
      {
        id: 'b1',
        plantilla_id: 'tpl-1',
        tipo: 'texto',
        titulo: 'Test Block',
        orden: 1,
        visible: true,
      } as any,
    ]);

    renderWithRouter(<TemplateEditor />);

    await screen.findByRole('heading', { name: /plantilla comercial/i });
    // The delete button should be reachable by aria-label
    const deleteBtn = screen.getByRole('button', { name: /eliminar bloque/i });
    expect(deleteBtn).toBeInTheDocument();
  });
});

// ─── Dashboard ───────────────────────────────────────────────────────────

describe('Dashboard page structure (PR2 reflow guard)', () => {
  it('renders dashboard heading and summary cards', async () => {
    const { Dashboard } = await import('../pages/Dashboard');
    renderWithRouter(<Dashboard />);

    expect(await screen.findByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByText(/productos/i)).toBeInTheDocument();
    const campañasElements = screen.getAllByText(/campañas/i);
    expect(campañasElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the recent campaigns section', async () => {
    const { Dashboard } = await import('../pages/Dashboard');
    renderWithRouter(<Dashboard />);

    await screen.findByRole('heading', { name: /dashboard/i });
    expect(screen.getByText(/campañas recientes/i)).toBeInTheDocument();
  });
});

// ─── Settings ────────────────────────────────────────────────────────────

describe('Settings page structure (PR2 reflow guard)', () => {
  it('renders the settings heading and form inputs', async () => {
    const { Settings } = await import('../pages/Settings');
    renderWithRouter(<Settings />);

    expect(await screen.findByRole('heading', { name: /configuración/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('120')).toBeInTheDocument();
    expect(screen.getByDisplayValue('+5312345678')).toBeInTheDocument();
  });

  it('renders the save button', async () => {
    const { Settings } = await import('../pages/Settings');
    renderWithRouter(<Settings />);

    await screen.findByRole('heading', { name: /configuración/i });
    expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeInTheDocument();
  });
});

describe('Settings responsive contracts (PR2 regression guards)', () => {
  it('save button has min-h-11 touch target', async () => {
    const { Settings } = await import('../pages/Settings');
    renderWithRouter(<Settings />);

    await screen.findByRole('heading', { name: /configuración/i });
    const saveBtn = screen.getByRole('button', { name: /guardar cambios/i });
    expect(saveBtn.className).toContain('min-h-11');
  });

  it('default-template controls use responsive flex-col sm:flex-row', async () => {
    const { Settings } = await import('../pages/Settings');
    renderWithRouter(<Settings />);

    await screen.findByRole('heading', { name: /configuración/i });
    // Find the default template ID input (read-only, with value)
    const templateInput = screen.getByDisplayValue('tpl-1');
    const controlsRow = templateInput.closest('div');
    expect(controlsRow?.className).toContain('flex-col');
    expect(controlsRow?.className).toContain('sm:flex-row');
    // Must have w-full for mobile
    expect(controlsRow?.className).toContain('w-full');

    const editBlocksLink = screen.getByRole('link', { name: /editar bloques/i });
    expect(editBlocksLink.className).toContain('min-h-11');
  });
});

// ─── Login ───────────────────────────────────────────────────────────────

describe('Login page structure (PR2 touch targets)', () => {
  it('renders email and password inputs with labels', async () => {
    const { Login } = await import('../pages/Login');
    renderWithRouter(<Login />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
  });

  it('renders the submit button', async () => {
    const { Login } = await import('../pages/Login');
    renderWithRouter(<Login />);

    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
  });
});

describe('Login responsive contracts (PR2 regression guards)', () => {
  it('submit button has min-h-11 touch target', async () => {
    const { Login } = await import('../pages/Login');
    renderWithRouter(<Login />);

    const submitBtn = screen.getByRole('button', { name: /entrar/i });
    expect(submitBtn.className).toContain('min-h-11');
  });

  it('email and password inputs have min-h-11', async () => {
    const { Login } = await import('../pages/Login');
    renderWithRouter(<Login />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);
    expect(emailInput.className).toContain('min-h-11');
    expect(passwordInput.className).toContain('min-h-11');
  });
});

// ─── Campaigns ───────────────────────────────────────────────────────────

describe('Campaigns page structure (PR2 touch targets)', () => {
  it('renders the campaigns heading and create button', async () => {
    const { Campaigns } = await import('../pages/Campaigns');
    renderWithRouter(<Campaigns />);

    expect(await screen.findByRole('heading', { name: /campañas/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nueva campaña/i })).toBeInTheDocument();
  });
});

describe('Campaigns responsive contracts (PR2 regression guards)', () => {
  it('create button has min-h-11 touch target', async () => {
    const { Campaigns } = await import('../pages/Campaigns');
    renderWithRouter(<Campaigns />);

    await screen.findByRole('heading', { name: /campañas/i });
    const createBtn = screen.getByRole('button', { name: /nueva campaña/i });
    expect(createBtn.className).toContain('min-h-11');
  });
});

// ─── ProductEditor ───────────────────────────────────────────────────────

describe('ProductEditor page structure (PR2 reflow guard)', () => {
  it('renders a product heading', async () => {
    const { ProductEditor } = await import('../pages/ProductEditor');
    renderWithRouter(<ProductEditor />);

    const heading = await screen.findByRole('heading', {
      name: /editar producto|nuevo producto/i,
    });
    expect(heading).toBeInTheDocument();
  });

  it('renders variant and content block sections', async () => {
    const { ProductEditor } = await import('../pages/ProductEditor');
    renderWithRouter(<ProductEditor />);

    await screen.findByRole('heading', {
      name: /editar producto|nuevo producto/i,
    });
    expect(screen.getByRole('heading', { name: /variantes/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /bloques de contenido/i })).toBeInTheDocument();
  });

  it('renders the save button', async () => {
    const { ProductEditor } = await import('../pages/ProductEditor');
    renderWithRouter(<ProductEditor />);

    await screen.findByRole('heading', {
      name: /editar producto|nuevo producto/i,
    });
    expect(screen.getByRole('button', { name: /guardar producto/i })).toBeInTheDocument();
  });
});

describe('ProductEditor responsive contracts (PR2 regression guards)', () => {
  it('content-block and list item controls use responsive and touch target classes', async () => {
    const { ProductEditor } = await import('../pages/ProductEditor');
    const { ProductService } = await import('../services/ProductService');
    const { ContentBlockService } = await import('../services/ContentBlockService');
    vi.mocked(ProductService.getProduct).mockResolvedValueOnce({
      id: 'p1',
      nombre: 'Test Product',
      categoria_id: 'cat1',
      imagen_url: 'https://example.com/img.jpg',
      precio_usd: 10,
      cantidad_por_caja: 1,
      estado: 'activo',
      marca: null,
    } as any);
    vi.mocked(ContentBlockService.getContentBlocksWithItems).mockResolvedValueOnce([
      {
        block: {
          id: 'cb-list',
          producto_id: 'p1',
          tipo: 'lista',
          titulo: 'Sabores disponibles',
          orden: 1,
        },
        items: [{ id: 'ci-list', bloque_id: 'cb-list', valor: 'Chocolate', orden: 1 }],
      } as any,
    ]);

    renderWithRoute(<ProductEditor />, '/product/p1', '/product/:id');

    await waitFor(() => {
      expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument();
    }, { timeout: 5000 });

    const blockTypeSelect = screen
      .getAllByRole('combobox')
      .find((element) => (element as HTMLSelectElement).value === 'lista');
    expect(blockTypeSelect).toBeDefined();
    const controlsRow = blockTypeSelect!.closest('div')?.parentElement;
    expect(controlsRow?.className).toContain('flex-col');
    expect(controlsRow?.className).toContain('sm:flex-row');

    const blockCard = controlsRow?.parentElement?.parentElement;
    expect(blockCard?.className).toContain('flex-col');
    expect(blockCard?.className).toContain('sm:flex-row');

    const listItemInput = screen.getByDisplayValue('Chocolate');
    expect(listItemInput.className).toContain('min-h-8');
    expect(listItemInput.className).toContain('min-w-0');
    const listItemRow = listItemInput.closest('div');
    expect(listItemRow?.className).toContain('items-start');
    expect(listItemRow?.className).toContain('min-w-0');

    const deleteItemButton = screen.getByRole('button', { name: /eliminar elemento/i });
    expect(deleteItemButton.className).toContain('min-h-8');
    expect(deleteItemButton.className).toContain('min-w-8');

    const addItemButton = screen.getByRole('button', { name: /agregar elemento/i });
    expect(addItemButton.className).toContain('min-h-8');
  });

  it('submit and cancel buttons have min-h-11 touch target', async () => {
    const { ProductEditor } = await import('../pages/ProductEditor');
    renderWithRouter(<ProductEditor />);

    await screen.findByRole('heading', {
      name: /editar producto|nuevo producto/i,
    });

    const saveBtn = screen.getByRole('button', { name: /guardar producto/i });
    expect(saveBtn.className).toContain('min-h-11');

    const cancelBtn = screen.getByRole('link', { name: /cancelar/i });
    expect(cancelBtn.className).toContain('min-h-11');
  });

  it('upload button has min-h-11 touch target', async () => {
    const { ProductEditor } = await import('../pages/ProductEditor');
    renderWithRouter(<ProductEditor />);

    await screen.findByRole('heading', {
      name: /editar producto|nuevo producto/i,
    });

    const uploadBtn = screen.getByRole('button', { name: /subir imagen/i });
    expect(uploadBtn.className).toContain('min-h-11');
  });

  it('content-block reorder and delete buttons have aria-labels', async () => {
    const { ProductEditor } = await import('../pages/ProductEditor');
    const { ContentBlockService } = await import('../services/ContentBlockService');
    // Provide blocks so reorder/delete buttons render
    vi.mocked(ContentBlockService.getContentBlocksWithItems).mockResolvedValueOnce([
      {
        block: {
          id: 'cb1',
          producto_id: 'p1',
          tipo: 'texto',
          titulo: 'Test Block',
          orden: 1,
        },
        items: [{ id: 'ci1', bloque_id: 'cb1', valor: 'Content', orden: 1 }],
      } as any,
    ]);

    // Must use route with :id so ProductEditor loads content blocks
    renderWithRoute(<ProductEditor />, '/product/p1', '/product/:id');

    await waitFor(() => {
      expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument();
    }, { timeout: 5000 });

    // Reorder buttons must have aria-labels
    const moveUpBtn = screen.getByRole('button', { name: /mover bloque arriba/i });
    expect(moveUpBtn).toBeInTheDocument();

    const moveDownBtn = screen.getByRole('button', { name: /mover bloque abajo/i });
    expect(moveDownBtn).toBeInTheDocument();

    // Delete block button must have aria-label
    const deleteBtn = screen.getByRole('button', { name: /eliminar bloque/i });
    expect(deleteBtn).toBeInTheDocument();
  });
});

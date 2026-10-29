import * as XLSX from 'xlsx';
import QRCode from 'qrcode';
import { AV_GROUPS, AVGroup } from '../types/inventory.ts';

/**
 * Generate a pseudo EAN-13 barcode
 * Standard 13-digit barcode starting with 84 (Spain country prefix)
 */
export function generateBarcode(seed?: string): string {
  const prefix = '84370';
  let rand = '';
  if (seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    rand = Math.abs(hash).toString().padStart(7, '0').slice(0, 7);
  } else {
    rand = Math.floor(1000000 + Math.random() * 9000000).toString();
  }

  const raw12 = `${prefix}${rand}`;
  // Calculate checksum for EAN-13
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(raw12[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return `${raw12}${checkDigit}`;
}

/**
 * Generate QR code Data URL for rendering and scanning
 */
export async function generateQrDataUrl(data: string): Promise<string> {
  try {
    return await QRCode.toDataURL(data, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 256,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Error generating QR code:', err);
    return '';
  }
}

/**
 * Guess / Map technical group from category or item name
 */
export function inferGroupFromCategory(category: string, name?: string): AVGroup {
  const c = (category || '').toLowerCase();
  const n = (name || '').toLowerCase();

  if (c.includes('cable') || n.includes('manguera') || n.includes('xlr') || n.includes('dmx')) {
    return 'CABLEADO';
  }
  if (c.includes('micro') || n.includes('shure') || n.includes('sennheiser') || n.includes('inalámbrico')) {
    return 'MICROFONÍA';
  }
  if (c.includes('ampli') || c.includes('etapa') || n.includes('lab gruppen') || n.includes('powersoft')) {
    return 'ETAPAS Y AMPLIFICACIÓN';
  }
  if (c.includes('mesa') || c.includes('consola') || n.includes('yamaha') || n.includes('midas') || n.includes('soundcraft')) {
    return 'MESAS DE MEZCLAS';
  }
  if (c.includes('altavoz') || c.includes('monitor') || n.includes('d&b') || n.includes('line array') || n.includes('subgrave')) {
    return 'SONIDO P.A. Y MONITORES';
  }
  if (c.includes('control') || n.includes('grandma') || n.includes('chamsys') || n.includes('avolites')) {
    return 'CONTROL DE ILUMINACIÓN';
  }
  if (c.includes('ilumin') || n.includes('foco') || n.includes('robe') || n.includes('martin') || n.includes('beam') || n.includes('wash')) {
    return 'ILUMINACIÓN Y ROBÓTICA';
  }
  if (c.includes('estructura') || c.includes('truss') || n.includes('eurotruss') || n.includes('torre') || n.includes('tarima')) {
    return 'ESTRUCTURAS Y TRUSSES';
  }
  if (c.includes('distri') || c.includes('eléctric') || n.includes('cetac') || n.includes('cuadro') || n.includes('schuko')) {
    return 'DISTRIBUCIÓN ELÉCTRICA';
  }
  if (c.includes('video') || c.includes('vídeo') || c.includes('pantalla') || n.includes('led') || n.includes('proyector')) {
    return 'VÍDEO Y PANTALLAS';
  }
  if (c.includes('flight') || c.includes('case') || n.includes('baúl') || n.includes('cofre')) {
    return 'FLIGHT CASES Y TRANSPORTE';
  }
  if (c.includes('consumible') || n.includes('cinta') || n.includes('givi') || n.includes('humo')) {
    return 'CONSUMIBLES';
  }
  if (c.includes('herramienta') || n.includes('garra') || n.includes('eslinga') || n.includes('llave')) {
    return 'HERRAMIENTAS Y ACCESORIOS';
  }
  return 'OTROS';
}

/**
 * Generate and trigger download of an official empty Excel template for the client
 * Includes realistic AV industry examples, step-by-step instructions, official technical groups, and a clean blank sheet.
 */
export function downloadEmptyExcelTemplate() {
  const wb = XLSX.utils.book_new();

  // Columns specification
  const templateHeaders = [
    'GRUPO',
    'CATEGORIA',
    'SUBCATEGORIA',
    'NOMBRE_ARTICULO',
    'MARCA',
    'MODELO',
    'CANTIDAD_TOTAL',
    'TIENE_NUMERO_SERIE',
    'NUMEROS_DE_SERIE',
    'CODIGO_BARRAS',
    'UBICACION_ALMACEN',
    'PRECIO_COMPRA',
    'STOCK_MINIMO',
    'UNIDAD_MEDIDA',
    'PROVEEDOR',
    'DESCRIPCION_NOTAS',
  ];

  // Comprehensive multi-department examples
  const sampleRows = [
    {
      GRUPO: 'MICROFONÍA',
      CATEGORIA: 'Microfonía Inalámbrica',
      SUBCATEGORIA: 'Vocales de Mano',
      NOMBRE_ARTICULO: 'Micrófono Inalámbrico Shure Axient Digital AD2/SM58',
      MARCA: 'Shure',
      MODELO: 'AD2/SM58 Handheld G56',
      CANTIDAD_TOTAL: 4,
      TIENE_NUMERO_SERIE: 'SI',
      NUMEROS_DE_SERIE: 'SH-AX-001, SH-AX-002, SH-AX-003, SH-AX-004',
      CODIGO_BARRAS: '',
      UBICACION_ALMACEN: 'Nave Central - Estantería A1 (Microfonía)',
      PRECIO_COMPRA: 850.0,
      STOCK_MINIMO: 2,
      UNIDAD_MEDIDA: 'Uds',
      PROVEEDOR: 'Earpro',
      DESCRIPCION_NOTAS: 'Banda G56 (470-636 MHz) con batería recargable SB900B',
    },
    {
      GRUPO: 'MESAS DE MEZCLAS',
      CATEGORIA: 'Consolas Digitales',
      SUBCATEGORIA: 'Superficie FOH/Monitores',
      NOMBRE_ARTICULO: 'Consola Digital Yamaha QL5 32 Canales Dante',
      MARCA: 'Yamaha',
      MODELO: 'QL5 Dante 32ch',
      CANTIDAD_TOTAL: 2,
      TIENE_NUMERO_SERIE: 'SI',
      NUMEROS_DE_SERIE: 'YAM-QL5-78914, YAM-QL5-78915',
      CODIGO_BARRAS: '',
      UBICACION_ALMACEN: 'Nave Central - Zona Mesas FOH',
      PRECIO_COMPRA: 9800.0,
      STOCK_MINIMO: 1,
      UNIDAD_MEDIDA: 'Uds',
      PROVEEDOR: 'Yamaha Commercial Audio',
      DESCRIPCION_NOTAS: '32 previos mic integrados, 16 salidas, interfaz Dante 64x64',
    },
    {
      GRUPO: 'SONIDO P.A. Y MONITORES',
      CATEGORIA: 'Line Array',
      SUBCATEGORIA: 'Cajas Acústicas',
      NOMBRE_ARTICULO: 'Altavoz Line Array d&b audiotechnik V8 Pasivo 3 Vías',
      MARCA: 'd&b audiotechnik',
      MODELO: 'V8 Loudspeaker',
      CANTIDAD_TOTAL: 8,
      TIENE_NUMERO_SERIE: 'SI',
      NUMEROS_DE_SERIE: 'DB-V8-101, DB-V8-102, DB-V8-103, DB-V8-104, DB-V8-105, DB-V8-106, DB-V8-107, DB-V8-108',
      CODIGO_BARRAS: '',
      UBICACION_ALMACEN: 'Nave Central - Bahía P.A.',
      PRECIO_COMPRA: 4100.0,
      STOCK_MINIMO: 2,
      UNIDAD_MEDIDA: 'Uds',
      PROVEEDOR: 'd&b audiotechnik España',
      DESCRIPCION_NOTAS: 'Caja pasiva 3 vías, dispersión 80º horizontal, rigging integrado',
    },
    {
      GRUPO: 'ETAPAS Y AMPLIFICACIÓN',
      CATEGORIA: 'Amplificación Digital',
      SUBCATEGORIA: 'Etapas 4 Canales Dante',
      NOMBRE_ARTICULO: 'Etapa de Potencia Powersoft X4 Dante 4x5200W',
      MARCA: 'Powersoft',
      MODELO: 'X4 Dante 4CH DSP',
      CANTIDAD_TOTAL: 2,
      TIENE_NUMERO_SERIE: 'SI',
      NUMEROS_DE_SERIE: 'PW-X4-201, PW-X4-202',
      CODIGO_BARRAS: '',
      UBICACION_ALMACEN: 'Nave Central - Estantería A1',
      PRECIO_COMPRA: 6200.0,
      STOCK_MINIMO: 1,
      UNIDAD_MEDIDA: 'Uds',
      PROVEEDOR: 'Equipson',
      DESCRIPCION_NOTAS: 'DSP ArmoníaPlus integrado, entradas analógicas, AES3 y Dante',
    },
    {
      GRUPO: 'ILUMINACIÓN Y ROBÓTICA',
      CATEGORIA: 'Cabezas Móviles',
      SUBCATEGORIA: 'Híbridas Beam/Spot/Wash',
      NOMBRE_ARTICULO: 'Cabeza Móvil Robe Robin MegaPointe Osram HRI 470W',
      MARCA: 'Robe Lighting',
      MODELO: 'MegaPointe Touring',
      CANTIDAD_TOTAL: 6,
      TIENE_NUMERO_SERIE: 'SI',
      NUMEROS_DE_SERIE: 'ROB-MP-001, ROB-MP-002, ROB-MP-003, ROB-MP-004, ROB-MP-005, ROB-MP-006',
      CODIGO_BARRAS: '',
      UBICACION_ALMACEN: 'Nave Central - Bahía Robótica',
      PRECIO_COMPRA: 6450.0,
      STOCK_MINIMO: 2,
      UNIDAD_MEDIDA: 'Uds',
      PROVEEDOR: 'Ben-Ri Electronica',
      DESCRIPCION_NOTAS: 'Zoom 1.8º a 42º, prisma dual, ruedas de gobos rotativos y fijos',
    },
    {
      GRUPO: 'CONTROL DE ILUMINACIÓN',
      CATEGORIA: 'Consolas de Luces',
      SUBCATEGORIA: 'Consolas DMX / Art-Net',
      NOMBRE_ARTICULO: 'Consola Iluminación MA Lighting grandMA3 light',
      MARCA: 'MA Lighting',
      MODELO: 'grandMA3 light',
      CANTIDAD_TOTAL: 1,
      TIENE_NUMERO_SERIE: 'SI',
      NUMEROS_DE_SERIE: 'MA3-LT-9021',
      CODIGO_BARRAS: '',
      UBICACION_ALMACEN: 'Nave Central - Zona Control Luces',
      PRECIO_COMPRA: 24500.0,
      STOCK_MINIMO: 1,
      UNIDAD_MEDIDA: 'Uds',
      PROVEEDOR: 'Stonex',
      DESCRIPCION_NOTAS: '2 pantallas táctiles motorizadas, 60 faders ejecutores, 8192 parámetros',
    },
    {
      GRUPO: 'VÍDEO Y PANTALLAS',
      CATEGORIA: 'Pantallas LED',
      SUBCATEGORIA: 'Módulos Rental Interior/Exterior',
      NOMBRE_ARTICULO: 'Módulo Pantalla LED Unilumin Upad IV P2.6 500x500mm',
      MARCA: 'Unilumin',
      MODELO: 'Upad IV P2.6',
      CANTIDAD_TOTAL: 24,
      TIENE_NUMERO_SERIE: 'SI',
      NUMEROS_DE_SERIE: 'LED-P26-001, LED-P26-002, LED-P26-003, LED-P26-004',
      CODIGO_BARRAS: '',
      UBICACION_ALMACEN: 'Nave Central - Bahía Pantallas LED',
      PRECIO_COMPRA: 890.0,
      STOCK_MINIMO: 4,
      UNIDAD_MEDIDA: 'Uds',
      PROVEEDOR: 'Unilumin Spain',
      DESCRIPCION_NOTAS: 'Frecuencia de refresco 3840 Hz, calibración color NovaStar A8s',
    },
    {
      GRUPO: 'CABLEADO',
      CATEGORIA: 'Mangueras y Multipares',
      SUBCATEGORIA: 'Mangueras Harting Audio',
      NOMBRE_ARTICULO: 'Manguera Audio Multipar 32 In / 8 Out Harting 50m',
      MARCA: 'Klotz',
      MODELO: 'PolyFIX 40CH Harting 50m',
      CANTIDAD_TOTAL: 4,
      TIENE_NUMERO_SERIE: 'NO',
      NUMEROS_DE_SERIE: '',
      CODIGO_BARRAS: '',
      UBICACION_ALMACEN: 'Nave Central - Zona Cableado Audio',
      PRECIO_COMPRA: 980.0,
      STOCK_MINIMO: 2,
      UNIDAD_MEDIDA: 'Uds',
      PROVEEDOR: 'Thomann B2B',
      DESCRIPCION_NOTAS: 'Montada en carrete Schill con ruedas de transporte pesadas',
    },
    {
      GRUPO: 'ESTRUCTURAS Y TRUSSES',
      CATEGORIA: 'Truss de Aluminio',
      SUBCATEGORIA: 'Truss Cuadrado 29cm',
      NOMBRE_ARTICULO: 'Tramo Truss Cuadrado 29cm Eurotruss FD34 2m',
      MARCA: 'Eurotruss',
      MODELO: 'FD34-200',
      CANTIDAD_TOTAL: 16,
      TIENE_NUMERO_SERIE: 'NO',
      NUMEROS_DE_SERIE: '',
      CODIGO_BARRAS: '',
      UBICACION_ALMACEN: 'Patio Exterior / Bahía Estructuras',
      PRECIO_COMPRA: 220.0,
      STOCK_MINIMO: 4,
      UNIDAD_MEDIDA: 'Uds',
      PROVEEDOR: 'Fluge Logística',
      DESCRIPCION_NOTAS: 'Aleación EN AW 6082 T6, incluye 4 bulones y pasadores R-clips',
    },
    {
      GRUPO: 'DISTRIBUCIÓN ELÉCTRICA',
      CATEGORIA: 'Cuadros Eléctricos',
      SUBCATEGORIA: 'Cuadros Cetac 63A',
      NOMBRE_ARTICULO: 'Cuadro Eléctrico Cetac 63A 3P+N+T a Salidas Cetac 32A/16A + Schuko',
      MARCA: 'PCE / Merz',
      MODELO: 'Distro 63A Touring',
      CANTIDAD_TOTAL: 3,
      TIENE_NUMERO_SERIE: 'SI',
      NUMEROS_DE_SERIE: 'DIS-63A-01, DIS-63A-02, DIS-63A-03',
      CODIGO_BARRAS: '',
      UBICACION_ALMACEN: 'Nave Central - Zona Distribución Eléctrica',
      PRECIO_COMPRA: 1450.0,
      STOCK_MINIMO: 1,
      UNIDAD_MEDIDA: 'Uds',
      PROVEEDOR: 'Elektra B2B',
      DESCRIPCION_NOTAS: 'Protección con magnetotérmicos curva C y diferenciales clase A 30mA',
    },
    {
      GRUPO: 'FLIGHT CASES Y TRANSPORTE',
      CATEGORIA: 'Baúles de Transporte',
      SUBCATEGORIA: 'Baúles Universales Touring',
      NOMBRE_ARTICULO: 'Flight Case Baúl Universal 120x60x60cm con Separadores',
      MARCA: 'Penn Elcom / ProCase',
      MODELO: 'Trunk 12060 Touring',
      CANTIDAD_TOTAL: 8,
      TIENE_NUMERO_SERIE: 'NO',
      NUMEROS_DE_SERIE: '',
      CODIGO_BARRAS: '',
      UBICACION_ALMACEN: 'Nave Central - Zona Cajas',
      PRECIO_COMPRA: 430.0,
      STOCK_MINIMO: 2,
      UNIDAD_MEDIDA: 'Uds',
      PROVEEDOR: 'Penn Elcom Spain',
      DESCRIPCION_NOTAS: 'Madera abedul 9mm, ruedas azules 100mm Guitel con freno, apilable',
    },
    {
      GRUPO: 'CONSUMIBLES',
      CATEGORIA: 'Adhesivos y Cintas',
      SUBCATEGORIA: 'Cinta Americana Pro',
      NOMBRE_ARTICULO: 'Cinta Americana Profesional Tesa 4651 Negra 50mm x 50m',
      MARCA: 'Tesa Tape',
      MODELO: 'Tesa 4651 Black 50x50',
      CANTIDAD_TOTAL: 40,
      TIENE_NUMERO_SERIE: 'NO',
      NUMEROS_DE_SERIE: '',
      CODIGO_BARRAS: '',
      UBICACION_ALMACEN: 'Nave Central - Estantería Consumibles',
      PRECIO_COMPRA: 16.5,
      STOCK_MINIMO: 10,
      UNIDAD_MEDIDA: 'Rollos',
      PROVEEDOR: 'Reyenvas / Tesa Pro',
      DESCRIPCION_NOTAS: 'Adhesivo caucho natural de alta adherencia sin dejar residuos en cables',
    },
  ];

  // Tab 1: Material_AV (con ejemplos reales de referencia)
  const wsTemplate = XLSX.utils.json_to_sheet(sampleRows, { header: templateHeaders });
  wsTemplate['!cols'] = [
    { wch: 26 }, // GRUPO
    { wch: 24 }, // CATEGORIA
    { wch: 24 }, // SUBCATEGORIA
    { wch: 55 }, // NOMBRE_ARTICULO
    { wch: 20 }, // MARCA
    { wch: 25 }, // MODELO
    { wch: 16 }, // CANTIDAD_TOTAL
    { wch: 20 }, // TIENE_NUMERO_SERIE
    { wch: 50 }, // NUMEROS_DE_SERIE
    { wch: 20 }, // CODIGO_BARRAS
    { wch: 38 }, // UBICACION_ALMACEN
    { wch: 18 }, // PRECIO_COMPRA
    { wch: 15 }, // STOCK_MINIMO
    { wch: 16 }, // UNIDAD_MEDIDA
    { wch: 25 }, // PROVEEDOR
    { wch: 60 }, // DESCRIPCION_NOTAS
  ];
  XLSX.utils.book_append_sheet(wb, wsTemplate, 'Material_AV');

  // Tab 2: Guía_Paso_a_Paso
  const guideRows = [
    {
      'CAMPO / COLUMNA': 'GRUPO',
      'OBLIGATORIO': 'SI',
      'FORMATO / VALORES': 'Elegir uno de los 14 grupos permitidos',
      'INSTRUCCIONES CLAVE': 'Consulta la pestaña "Grupos_Permitidos". Debe ser exactamente uno de los 14 nombres (ej: MICROFONÍA, CABLEADO, MESAS DE MEZCLAS, etc.)',
    },
    {
      'CAMPO / COLUMNA': 'NOMBRE_ARTICULO',
      'OBLIGATORIO': 'SI',
      'FORMATO / VALORES': 'Texto claro y específico',
      'INSTRUCCIONES CLAVE': 'Nombre comercial completo del equipo (ej: "Micrófono Inalámbrico Shure Axient AD2/SM58")',
    },
    {
      'CAMPO / COLUMNA': 'CANTIDAD_TOTAL',
      'OBLIGATORIO': 'SI',
      'FORMATO / VALORES': 'Número entero mayor a 0',
      'INSTRUCCIONES CLAVE': 'Total de unidades existentes de este artículo en tu inventario',
    },
    {
      'CAMPO / COLUMNA': 'TIENE_NUMERO_SERIE',
      'OBLIGATORIO': 'SI',
      'FORMATO / VALORES': 'SI o NO',
      'INSTRUCCIONES CLAVE': 'Pon "SI" si cada unidad tiene trazabilidad individual (micros, etapas, mesas, luces) o "NO" para cables, trusses y consumibles',
    },
    {
      'CAMPO / COLUMNA': 'NUMEROS_DE_SERIE',
      'OBLIGATORIO': 'OPCIONAL',
      'FORMATO / VALORES': 'Seriales separados por coma ( , )',
      'INSTRUCCIONES CLAVE': 'Ejemplo: "SN-001, SN-002, SN-003". Si dejas en blanco y pusiste TIENE_NUMERO_SERIE="SI", el sistema creará correlativos automáticamente con código QR individual',
    },
    {
      'CAMPO / COLUMNA': 'CODIGO_BARRAS',
      'OBLIGATORIO': 'OPCIONAL',
      'FORMATO / VALORES': 'EAN-13 o código alfanumérico',
      'INSTRUCCIONES CLAVE': 'Si lo dejas en blanco, JD Control de Stock genera automáticamente un código EAN-13 oficial y código QR listo para imprimir y escanear',
    },
    {
      'CAMPO / COLUMNA': 'MARCA',
      'OBLIGATORIO': 'RECOMENDADO',
      'FORMATO / VALORES': 'Texto (ej: Shure, Robe, Yamaha)',
      'INSTRUCCIONES CLAVE': 'Fabricante o marca oficial',
    },
    {
      'CAMPO / COLUMNA': 'MODELO',
      'OBLIGATORIO': 'RECOMENDADO',
      'FORMATO / VALORES': 'Texto (ej: QL5, AD2, MegaPointe)',
      'INSTRUCCIONES CLAVE': 'Modelo de fábrica del fabricante',
    },
    {
      'CAMPO / COLUMNA': 'UBICACION_ALMACEN',
      'OBLIGATORIO': 'RECOMENDADO',
      'FORMATO / VALORES': 'Texto descriptivo de ubicación',
      'INSTRUCCIONES CLAVE': 'Estantería, nave, rack o zona donde se almacena habitualmente (ej: "Nave Central - Estantería A1")',
    },
    {
      'CAMPO / COLUMNA': 'PRECIO_COMPRA',
      'OBLIGATORIO': 'RECOMENDADO',
      'FORMATO / VALORES': 'Número en Euros (ej: 850.00)',
      'INSTRUCCIONES CLAVE': 'Coste unitario sin IVA para valoración de activos y cálculo de amortización',
    },
    {
      'CAMPO / COLUMNA': 'STOCK_MINIMO',
      'OBLIGATORIO': 'OPCIONAL',
      'FORMATO / VALORES': 'Número entero (ej: 2)',
      'INSTRUCCIONES CLAVE': 'Alerta de reposición automática si el inventario disponible desciende de este umbral',
    },
    {
      'CAMPO / COLUMNA': 'UNIDAD_MEDIDA',
      'OBLIGATORIO': 'OPCIONAL',
      'FORMATO / VALORES': 'Uds, Metros, Cajas, Rollos',
      'INSTRUCCIONES CLAVE': 'Unidad de contabilidad física (por defecto: Uds)',
    },
    {
      'CAMPO / COLUMNA': 'PROVEEDOR',
      'OBLIGATORIO': 'OPCIONAL',
      'FORMATO / VALORES': 'Nombre del distribuidor',
      'INSTRUCCIONES CLAVE': 'Distribuidor oficial o proveedor de compra (ej: Earpro, Thomann B2B, Equipson)',
    },
    {
      'CAMPO / COLUMNA': 'DESCRIPCION_NOTAS',
      'OBLIGATORIO': 'OPCIONAL',
      'FORMATO / VALORES': 'Texto libre',
      'INSTRUCCIONES CLAVE': 'Observaciones técnicas, rangos de frecuencia, conectores, voltajes o accesorios incluidos',
    },
  ];

  const wsGuide = XLSX.utils.json_to_sheet(guideRows);
  wsGuide['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 35 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Guia_Paso_a_Paso');

  // Tab 3: Grupos_Permitidos
  const groupsList = AV_GROUPS.map((g) => ({
    'GRUPO TÉCNICO OFICIAL': g,
    'DEPARTAMENTO': 
      g === 'MICROFONÍA' || g === 'MESAS DE MEZCLAS' || g === 'ETAPAS Y AMPLIFICACIÓN' || g === 'SONIDO P.A. Y MONITORES'
        ? 'Sonido y Audio Profesional'
        : g === 'ILUMINACIÓN Y ROBÓTICA' || g === 'CONTROL DE ILUMINACIÓN'
        ? 'Iluminación Espectacular'
        : g === 'VÍDEO Y PANTALLAS'
        ? 'Vídeo y Proyección'
        : g === 'ESTRUCTURAS Y TRUSSES'
        ? 'Rigging y Maquinaria'
        : g === 'DISTRIBUCIÓN ELÉCTRICA'
        ? 'Electricidad y Potencia'
        : g === 'CABLEADO'
        ? 'Conectividad y Patch'
        : g === 'FLIGHT CASES Y TRANSPORTE'
        ? 'Logística y Embalaje'
        : g === 'CONSUMIBLES'
        ? 'Material Fungible'
        : 'Auxiliar / General',
    'EJEMPLOS DE EQUIPOS VÁLIDOS':
      g === 'CABLEADO'
        ? 'Cables XLR, DMX 5 pines, Socapex, mangueras multipar Harting, patch ethernet Cat6 Dante, mangueras Speakon'
        : g === 'MICROFONÍA'
        ? 'Micrófonos inalámbricos UHF/digitales, diademas DPA, cápsulas condensador Neumann, micrófonos de batería, splitters pasivos'
        : g === 'ETAPAS Y AMPLIFICACIÓN'
        ? 'Etapas de potencia multicanal Powersoft, Lab Gruppen, amplificadores d&b serie D, procesadores Lake, DSP'
        : g === 'MESAS DE MEZCLAS'
        ? 'Consolas FOH y Monitores Yamaha QL/CL, Midas Pro/M32, DiGiCo SD/Quantum, cajas de escenario Racks RIO'
        : g === 'SONIDO P.A. Y MONITORES'
        ? 'Cajas acústicas line array d&b / L-Acoustics, subgraves cardioides, cuñas de escenario de perfil bajo, monitores de campo cercano'
        : g === 'ILUMINACIÓN Y ROBÓTICA'
        ? 'Cabezas móviles Beam, Spot, Wash, Profile, focos Par LED RGBW, cegadoras molefay, barras motorizadas, estrobos'
        : g === 'CONTROL DE ILUMINACIÓN'
        ? 'Consolas grandMA3 / grandMA2, ChamSys MagicQ, Avolites, nodos Art-Net / sACN, splitters DMX ópticos'
        : g === 'ESTRUCTURAS Y TRUSSES'
        ? 'Tramos truss cuadrado 29cm y 40cm, círculos de truss, torres elevadoras VMB/Kuzar, tarimas de escenario Rosco/Guil, garra coupler'
        : g === 'DISTRIBUCIÓN ELÉCTRICA'
        ? 'Cuadros Cetac 32A, 63A, 125A trifásicos con magnetotérmicos y diferenciales clase A, mangueras trifásicas, SAI/UPS'
        : g === 'VÍDEO Y PANTALLAS'
        ? 'Módulos pantalla LED Unilumin / Absen, procesadores escaladores NovaStar, proyectores láser 10k-20k, matrices Blackmagic SDI/HDMI'
        : g === 'FLIGHT CASES Y TRANSPORTE'
        ? 'Baúles universales touring con ruedas, racks amortiguados antishock, fundas acolchadas de protección'
        : g === 'HERRAMIENTAS Y ACCESORIOS'
        ? 'Llaves de truss martillo de bronce, cinchas carraca de amarre, eslingas de acero con grilletes, sonómetros'
        : g === 'CONSUMIBLES'
        ? 'Cinta americana Tesa 4651, cinta aislante PVC, filtros de corrección Rosco/Lee, líquido de humo Hazer, pilas AA alcalinas'
        : 'Equipos auxiliares de intercom, walkies Motorola, escaleras de tijera y material de producción',
  }));

  const wsInstructions = XLSX.utils.json_to_sheet(groupsList);
  wsInstructions['!cols'] = [{ wch: 30 }, { wch: 30 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Grupos_Permitidos');

  // Tab 4: Plantilla_Vacia_Limpia (Para que el cliente empiece a pegar sus datos directamente)
  const wsEmpty = XLSX.utils.json_to_sheet([], { header: templateHeaders });
  wsEmpty['!cols'] = wsTemplate['!cols'];
  XLSX.utils.book_append_sheet(wb, wsEmpty, 'Plantilla_Vacia_Limpia');

  // Export file
  XLSX.writeFile(wb, 'Plantilla_Oficial_Material_AV_JD_Stock.xlsx');
}

export interface ParsedItemRow {
  group: string;
  category: string;
  subcategory: string;
  name: string;
  brand: string;
  model: string;
  totalQuantity: number;
  hasSerialNumbers: boolean;
  serialNumbers: string[];
  barcode?: string;
  defaultLocationName?: string;
  purchasePrice?: number;
  minStock?: number;
  unit?: string;
  supplier?: string;
  description?: string;
  rawRow: any;
}

/**
 * Parse an uploaded XLS, XLSX, or CSV file into validated item rows
 */
export async function parseUploadedSpreadsheet(file: File): Promise<ParsedItemRow[]> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });

  // Intelligent sheet finder (prioritizes data sheets with items)
  let targetSheetName = workbook.SheetNames[0];
  const preferredNames = ['Plantilla_Vacia_Limpia', 'Material_AV', 'Material', 'Inventario', 'Material_AV_Inventario'];

  for (const name of workbook.SheetNames) {
    if (name === 'Guia_Paso_a_Paso' || name === 'Grupos_Permitidos') continue;
    const sheet = workbook.Sheets[name];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (rows.some((r) => r['NOMBRE_ARTICULO'] || r['Nombre'] || r['Articulo'] || r['Item'])) {
      targetSheetName = name;
      if (preferredNames.includes(name)) break;
    }
  }

  const worksheet = workbook.Sheets[targetSheetName] || workbook.Sheets[workbook.SheetNames[0]];
  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  const parsed: ParsedItemRow[] = [];

  for (const row of rawRows) {
    // Read normalized column values
    const name = String(row['NOMBRE_ARTICULO'] || row['Nombre'] || row['Articulo'] || row['Item'] || '').trim();
    if (!name) continue; // Skip blank lines

    let group = String(row['GRUPO'] || row['Grupo'] || '').trim().toUpperCase();
    const category = String(row['CATEGORIA'] || row['Categoría'] || row['Categoria'] || 'General').trim();
    const subcategory = String(row['SUBCATEGORIA'] || row['Subcategoría'] || 'General').trim();

    if (!group || !AV_GROUPS.includes(group as any)) {
      group = inferGroupFromCategory(category, name);
    }

    const brand = String(row['MARCA'] || row['Marca'] || 'Genérica').trim();
    const model = String(row['MODELO'] || row['Modelo'] || '').trim();

    const qtyVal = Number(row['CANTIDAD_TOTAL'] || row['Cantidad'] || row['Total'] || 1);
    const totalQuantity = isNaN(qtyVal) || qtyVal < 1 ? 1 : Math.round(qtyVal);

    const hasSerialVal = String(row['TIENE_NUMERO_SERIE'] || row['Tiene_Serial'] || row['Serial'] || '').toLowerCase();
    const hasSerialNumbers =
      hasSerialVal.includes('si') ||
      hasSerialVal.includes('sí') ||
      hasSerialVal.includes('yes') ||
      hasSerialVal.includes('true') ||
      hasSerialVal === '1';

    // Parse serial numbers
    const serialStr = String(row['NUMEROS_DE_SERIE'] || row['Numeros_Serie'] || row['Serials'] || '').trim();
    let serialNumbers: string[] = [];
    if (serialStr) {
      serialNumbers = serialStr
        .split(/[,;\n\r]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }

    const barcode = String(row['CODIGO_BARRAS'] || row['Barcode'] || '').trim();
    const locationName = String(row['UBICACION_ALMACEN'] || row['Ubicación'] || row['Ubicacion'] || 'Nave Central').trim();
    const purchasePrice = Number(row['PRECIO_COMPRA'] || row['Precio'] || 0) || 0;
    const minStock = Number(row['STOCK_MINIMO'] || row['Minimo'] || 2) || 2;
    const unit = String(row['UNIDAD_MEDIDA'] || row['Unidad'] || 'Uds').trim();
    const supplier = String(row['PROVEEDOR'] || row['Proveedor'] || '').trim();
    const description = String(row['DESCRIPCION_NOTAS'] || row['Descripcion'] || row['Notas'] || '').trim();

    parsed.push({
      group,
      category,
      subcategory,
      name,
      brand,
      model,
      totalQuantity,
      hasSerialNumbers,
      serialNumbers,
      barcode: barcode || undefined,
      defaultLocationName: locationName,
      purchasePrice,
      minStock,
      unit,
      supplier,
      description,
      rawRow: row,
    });
  }

  return parsed;
}

/**
 * Generate official EPC QR payload for SEPA Credit Transfers
 * Standard recognized by CaixaBank, BBVA, Santander, Revolut, etc.
 */
export function buildSepaEpcPayload(params: {
  bic?: string;
  recipientName: string;
  iban: string;
  amount: number;
  remittanceText: string;
}): string {
  const cleanIban = params.iban.replace(/\s+/g, '').toUpperCase();
  const cleanBic = (params.bic || 'CAIXESBBXXX').replace(/\s+/g, '').toUpperCase();
  const formattedAmount = `EUR${params.amount.toFixed(2)}`;

  // EPC standard: lines separated by \n
  return [
    'BCD',
    '002',
    '1',
    'SCT',
    cleanBic,
    params.recipientName.slice(0, 70),
    cleanIban,
    formattedAmount,
    '',
    params.remittanceText.slice(0, 140),
    '',
  ].join('\n');
}

/**
 * Generate formatted WhatsApp message for Contract & 10% Reservation deposit.
 * Uses only standard UTF-8 text and universal formatting to guarantee zero encoding corruption or question mark glyphs.
 */
export function composeWhatsAppContractMessage(contract: {
  code: string;
  clientName: string;
  eventName: string;
  eventDate: string;
  returnDate?: string;
  eventLocation: string;
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
  paymentType?: 'deposit_10' | 'full_payment';
  items?: Array<{
    itemName: string;
    quantity: number;
    days?: number;
    unitPrice?: number;
    totalPrice?: number;
  }>;
  bankDetails: {
    bankName: string;
    accountHolder: string;
    iban: string;
    bic?: string;
    bizumPhone?: string;
    hasBizum?: boolean;
    paymentConcept: string;
  };
}): string {
  const isFullPayment = contract.paymentType === 'full_payment';
  const targetPaymentAmount = isFullPayment ? contract.totalAmount : contract.depositAmount;

  const dateFormatted = contract.eventDate
    ? new Date(contract.eventDate).toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Pendiente de definir';

  const returnDateFormatted = contract.returnDate
    ? new Date(contract.returnDate).toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  // Build dates description
  let dateSection = `- *Fecha de Inicio / Montaje:* ${dateFormatted}`;
  if (returnDateFormatted && returnDateFormatted !== dateFormatted) {
    dateSection += `\n- *Fecha de Fin / Desmontaje:* ${returnDateFormatted}`;
  }

  // Build itemized equipment list
  let equipmentSection = '';
  if (contract.items && contract.items.length > 0) {
    const lines = contract.items.map((item) => {
      const daysText = item.days && item.days > 1 ? ` (${item.days} dias)` : '';
      return `  - ${item.quantity}x ${item.itemName}${daysText}`;
    });
    equipmentSection = `\n*RESERVA DE EQUIPO Y MATERIAL ASIGNADO:*\n${lines.join('\n')}\n`;
  }

  // Only include Bizum if enabled
  const bizumLine =
    contract.bankDetails.hasBizum && contract.bankDetails.bizumPhone
      ? `- *Bizum de Empresa:* ${contract.bankDetails.bizumPhone}\n`
      : '';

  const paymentBreakdown = isFullPayment
    ? `*DESGLOSE ECONOMICO (PAGO TOTAL):*
- *Presupuesto Total (100%):* *${contract.totalAmount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR* (IVA incl.)
- *Restante:* 0.00 EUR (Abono completo)`
    : `*DESGLOSE ECONOMICO:*
- *Presupuesto Total:* ${contract.totalAmount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR (IVA incl.)
- *ANTICIPO 10% RESERVA:* *${contract.depositAmount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR*
- *Restante (90% al montaje):* ${contract.remainingAmount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;

  const instructionText = isFullPayment
    ? `*IMPORTANTE:* Para confirmar el pago integro del servicio y asegurar la reserva y disponibilidad de los equipos tecnicos, por favor realice la transferencia del 100% (${targetPaymentAmount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR) y remitanos el justificante respondiendo a este mensaje.`
    : `*IMPORTANTE:* Para asegurar la reserva y disponibilidad de los equipos tecnicos y bloquear definitivamente la fecha en nuestra agenda, por favor realice la transferencia del 10% de fianza (${targetPaymentAmount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR) y remitanos el comprobante respondiendo a este mensaje.`;

  const text = `*JD CONTROL DE STOCK - FACTURA Y CONTRATO DE SERVICIO*

Hola *${contract.clientName}*, le enviamos el desglose oficial de su presupuesto y reserva tecnica:

*DETALLES DEL EVENTO:*
- *Evento:* ${contract.eventName}
${dateSection}
- *Lugar / Recinto:* ${contract.eventLocation || 'Pendiente de definir'}
- *Nº Contrato / Factura:* ${contract.code}
${equipmentSection}
----------------------------------------
${paymentBreakdown}
----------------------------------------

*DATOS PARA TRANSFERENCIA BANCARIA INMEDIATA:*
- *Beneficiario:* ${contract.bankDetails.accountHolder}
- *Entidad:* ${contract.bankDetails.bankName}
- *IBAN:* ${contract.bankDetails.iban}
- *Concepto obligatorio:* ${contract.bankDetails.paymentConcept}
${bizumLine}
${instructionText}

Quedamos a su entera disposicion.
*JD Sonido e Iluminacion*`;

  return text;
}


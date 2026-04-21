export const DYNAMIC_OPERATOR_OPTIONS = [
  { value: 'all', label: 'Tat ca' },
  { value: 'gt', label: 'Lon hon' },
  { value: 'lt', label: 'Nho hon' },
  { value: 'eq', label: 'Bang' },
  { value: 'range', label: 'Khoang' },
  { value: 'lien_tiep', label: 'Lien tiep' },
]

export const TIME_SERIES_COMPARATOR_OPTIONS = [
  { value: '>', label: 'Lon hon' },
  { value: '<', label: 'Nho hon' },
  { value: '=', label: 'Bang' },
]

export const PERIOD_TYPE_OPTIONS = [
  { value: 'quarter', label: 'Quy' },
  { value: 'year', label: 'Nam' },
]

export const FILTER_GROUPS = [
  {
    id: 'by_index',
    label: 'Theo chi so',
    description: 'Loc theo cac metric tai chinh cu the nhu ROE, P/E, bien loi nhuan.',
    children: [
      {
        id: 'index_market',
        label: 'Chi so thi truong',
        children: [
          {
            id: 'pe_ratio',
            label: 'P/E',
            unit: 'lan',
            description: 'Chi so gia tren thu nhap',
            apiMinKey: 'min_pe',
            apiMaxKey: 'max_pe',
          },
          {
            id: 'pb_ratio',
            label: 'P/B',
            unit: 'lan',
            description: 'Chi so gia tren gia tri so sach',
            apiMinKey: 'min_pb',
            apiMaxKey: 'max_pb',
          },
          {
            id: 'market_cap',
            label: 'Von hoa thi truong',
            unit: 'Ty VND',
            description: 'Quy mo doanh nghiep',
          },
        ],
      },
      {
        id: 'index_profitability',
        label: 'Hieu qua kinh doanh',
        children: [
          {
            id: 'roe',
            label: 'ROE',
            unit: '%',
            description: 'Hieu qua su dung von chu so huu',
            apiMinKey: 'min_roe',
            apiMaxKey: 'max_roe',
            supportsTimeSeries: true,
            defaultPeriodType: 'year',
          },
          {
            id: 'roa',
            label: 'ROA',
            unit: '%',
            description: 'Hieu qua su dung tong tai san',
            apiMinKey: 'min_roa',
          },
          {
            id: 'gross_margin',
            label: 'Bien loi nhuan gop',
            unit: '%',
            description: 'Loi nhuan gop tren doanh thu',
            apiMinKey: 'min_gross_margin',
          },
          {
            id: 'net_margin',
            label: 'Bien loi nhuan rong',
            unit: '%',
            description: 'Loi nhuan rong tren doanh thu',
            apiMinKey: 'min_net_margin',
          },
        ],
      },
      {
        id: 'index_health',
        label: 'Suc khoe tai chinh',
        children: [
          {
            id: 'debt_to_equity',
            label: 'No/Von chu so huu (D/E)',
            unit: 'lan',
            description: 'Muc do don bay tai chinh',
            apiMaxKey: 'max_de',
          },
          {
            id: 'current_ratio',
            label: 'Current Ratio',
            unit: 'lan',
            description: 'Kha nang thanh toan ngan han',
            apiMinKey: 'min_current_ratio',
          },
          {
            id: 'f_score',
            label: 'Piotroski F-Score',
            unit: 'diem',
            description: 'Danh gia suc khoe tai chinh tong hop',
            apiMinKey: 'min_f_score',
          },
        ],
      },
      {
        id: 'index_growth',
        label: 'Tang truong',
        children: [
          {
            id: 'revenue_growth',
            label: 'Tang truong doanh thu',
            unit: '%',
            description: 'Tang truong doanh thu theo ky',
            apiMinKey: 'min_revenue_growth',
            supportsTimeSeries: true,
            defaultPeriodType: 'quarter',
          },
          {
            id: 'profit_growth',
            label: 'Tang truong loi nhuan',
            unit: '%',
            description: 'Tang truong loi nhuan theo ky',
            apiMinKey: 'min_profit_growth',
            supportsTimeSeries: true,
            defaultPeriodType: 'quarter',
          },
        ],
      },
    ],
  },
  {
    id: 'by_method',
    label: 'Theo phuong phap',
    description: 'Loc theo bo quy tac cua tung truong phai dau tu nhu CANSLIM, GARP, Value.',
    children: [
      {
        id: 'method_value',
        label: 'Value Investing',
        children: [
          {
            id: 'value_pe',
            label: 'P/E thap',
            unit: 'lan',
            description: 'Co phieu re theo thu nhap',
            apiMaxKey: 'max_pe',
          },
          {
            id: 'value_pb',
            label: 'P/B thap',
            unit: 'lan',
            description: 'Muc gia thap theo gia tri so sach',
            apiMaxKey: 'max_pb',
          },
          {
            id: 'value_roe',
            label: 'ROE dat nguong chat luong',
            unit: '%',
            description: 'Ket hop gia re va chat luong',
            apiMinKey: 'min_roe',
          },
        ],
      },
      {
        id: 'method_canslim',
        label: 'CANSLIM',
        children: [
          {
            id: 'canslim_revenue_growth',
            label: 'Tang truong doanh thu',
            unit: '%',
            description: 'Doanh thu tang manh theo quy',
            apiMinKey: 'min_revenue_growth',
            supportsTimeSeries: true,
            defaultPeriodType: 'quarter',
          },
          {
            id: 'canslim_profit_growth',
            label: 'Tang truong loi nhuan',
            unit: '%',
            description: 'Loi nhuan tang manh theo quy',
            apiMinKey: 'min_profit_growth',
            supportsTimeSeries: true,
            defaultPeriodType: 'quarter',
          },
          {
            id: 'canslim_roe',
            label: 'ROE cao',
            unit: '%',
            description: 'Nang luc sinh loi ben vung',
            apiMinKey: 'min_roe',
          },
        ],
      },
      {
        id: 'method_garp',
        label: 'GARP',
        children: [
          {
            id: 'garp_pe',
            label: 'P/E hop ly',
            unit: 'lan',
            description: 'Khong mua qua dat',
            apiMaxKey: 'max_pe',
          },
          {
            id: 'garp_profit_growth',
            label: 'Tang truong loi nhuan on',
            unit: '%',
            description: 'Tang truong duy tri theo quy',
            apiMinKey: 'min_profit_growth',
            supportsTimeSeries: true,
            defaultPeriodType: 'quarter',
          },
          {
            id: 'garp_roe',
            label: 'ROE toi thieu',
            unit: '%',
            description: 'Hieu qua su dung von dat nguong',
            apiMinKey: 'min_roe',
          },
        ],
      },
      {
        id: 'method_quality',
        label: 'Quality Compounder',
        children: [
          {
            id: 'quality_fscore',
            label: 'F-Score cao',
            unit: 'diem',
            description: 'Suc khoe tai chinh tong hop',
            apiMinKey: 'min_f_score',
          },
          {
            id: 'quality_roe',
            label: 'ROE cao va on dinh',
            unit: '%',
            description: 'Hieu qua bo sung cho F-Score',
            apiMinKey: 'min_roe',
          },
          {
            id: 'quality_de',
            label: 'Don bay thap',
            unit: 'lan',
            description: 'No vay trong nguong an toan',
            apiMaxKey: 'max_de',
          },
          {
            id: 'quality_current_ratio',
            label: 'Thanh khoan ngan han tot',
            unit: 'lan',
            description: 'Current ratio tren nguong',
            apiMinKey: 'min_current_ratio',
          },
        ],
      },
    ],
  },
]

export const METRIC_TREE = FILTER_GROUPS

function flattenMetrics(tree, collector = []) {
  tree.forEach((node) => {
    if (node.children?.length) {
      flattenMetrics(node.children, collector)
      return
    }

    collector.push(node)
  })

  return collector
}

export const FLAT_METRICS = flattenMetrics(METRIC_TREE)

export const METRIC_BY_ID = FLAT_METRICS.reduce((acc, metric) => {
  acc[metric.id] = metric
  return acc
}, {})
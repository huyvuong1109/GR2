function toNumberOrNull(rawValue) {
  if (rawValue === '' || rawValue === null || rawValue === undefined) {
    return null
  }

  const parsed = Number(rawValue)
  return Number.isFinite(parsed) ? parsed : null
}

function toIntOrNull(rawValue) {
  const numeric = toNumberOrNull(rawValue)
  if (numeric === null) {
    return null
  }
  return Math.max(1, Math.trunc(numeric))
}

function periodUnitFromType(periodType) {
  return periodType === 'year' ? 'năm' : 'quý'
}

export function createDefaultCondition(metric) {
  return {
    operator: 'all',
    value: '',
    rangeFrom: '',
    rangeTo: '',
    timeSeries: {
      comparator: '>',
      threshold: '',
      periods: '3',
      periodType: metric?.defaultPeriodType || 'quarter',
    },
  }
}

export function buildDynamicPayload({ selectedMetricIds, conditionsByMetric, metricById }) {
  return selectedMetricIds
    .map((metricId) => {
      const metric = metricById[metricId]
      const condition = conditionsByMetric[metricId]

      if (!metric || !condition || condition.operator === 'all') {
        return null
      }

      const base = {
        id: metric.id,
        name: metric.label,
      }

      if (condition.operator === 'range') {
        const fromValue = toNumberOrNull(condition.rangeFrom)
        const toValue = toNumberOrNull(condition.rangeTo)

        if (fromValue === null && toValue === null) {
          return null
        }

        return {
          ...base,
          operator: 'range',
          value: {
            from: fromValue,
            to: toValue,
          },
          unit: metric.unit,
        }
      }

      if (condition.operator === 'lien_tiep') {
        const thresholdValue = toNumberOrNull(condition.timeSeries?.threshold)
        const periods = toIntOrNull(condition.timeSeries?.periods)

        if (thresholdValue === null || periods === null) {
          return null
        }

        const periodType = condition.timeSeries?.periodType || metric.defaultPeriodType || 'quarter'
        const comparator = condition.timeSeries?.comparator || '>'

        return {
          ...base,
          operator: 'lien_tiep',
          value: periods,
          unit: periodUnitFromType(periodType),
          series: {
            comparator,
            threshold: thresholdValue,
            periods,
            periodType,
          },
        }
      }

      const inputValue = toNumberOrNull(condition.value)
      if (inputValue === null) {
        return null
      }

      const operatorMap = {
        gt: '>',
        lt: '<',
        eq: '=',
      }

      return {
        ...base,
        operator: operatorMap[condition.operator] || condition.operator,
        value: inputValue,
        unit: metric.unit,
      }
    })
    .filter(Boolean)
}

function applyRangeToQuery(queryParams, metric, valueRange) {
  const fromValue = toNumberOrNull(valueRange?.from)
  const toValue = toNumberOrNull(valueRange?.to)

  if (fromValue !== null && metric.apiMinKey) {
    queryParams[metric.apiMinKey] = fromValue
  }

  if (toValue !== null && metric.apiMaxKey) {
    queryParams[metric.apiMaxKey] = toValue
  }
}

function applyPointToQuery(queryParams, metric, operator, value) {
  const normalizedValue = toNumberOrNull(value)
  if (normalizedValue === null) {
    return
  }

  if (operator === '>' && metric.apiMinKey) {
    queryParams[metric.apiMinKey] = normalizedValue
    return
  }

  if (operator === '<' && metric.apiMaxKey) {
    queryParams[metric.apiMaxKey] = normalizedValue
    return
  }

  if (operator === '=') {
    if (metric.apiMinKey) {
      queryParams[metric.apiMinKey] = normalizedValue
    }
    if (metric.apiMaxKey) {
      queryParams[metric.apiMaxKey] = normalizedValue
    }
    if (!metric.apiMinKey && !metric.apiMaxKey && metric.apiExactKey) {
      queryParams[metric.apiExactKey] = normalizedValue
    }
  }
}

export function buildAdvancedQueryFromPayload(payload, metricById) {
  const queryParams = {}

  payload.forEach((filterItem) => {
    const metric = metricById[filterItem.id]
    if (!metric) {
      return
    }

    if (filterItem.operator === 'range') {
      applyRangeToQuery(queryParams, metric, filterItem.value)
      return
    }

    if (filterItem.operator === 'lien_tiep') {
      const thresholdValue = toNumberOrNull(filterItem.series?.threshold)
      const comparator = filterItem.series?.comparator

      if (thresholdValue !== null) {
        applyPointToQuery(queryParams, metric, comparator, thresholdValue)
      }
      return
    }

    applyPointToQuery(queryParams, metric, filterItem.operator, filterItem.value)
  })

  return queryParams
}

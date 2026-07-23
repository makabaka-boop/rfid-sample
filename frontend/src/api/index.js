import request from '@/utils/request'

export const loginApi = (username, password) => request.post('/auth/login', { username, password })
export const getMeApi = () => request.get('/auth/me')
export const getUsersApi = () => request.get('/users')

export const getTagTemplatesApi = () => request.get('/tag-templates')
export const createTagTemplateApi = (data) => request.post('/tag-templates', data)

export const getTagsApi = (params) => request.get('/tags', { params })
export const createTagApi = (data) => request.post('/tags', data)

export const getCategoriesApi = () => request.get('/categories')
export const createCategoryApi = (data) => request.post('/categories', data)

export const getGarmentsApi = (params) => request.get('/garments', { params })
export const getGarmentApi = (id) => request.get(`/garments/${id}`)
export const createGarmentApi = (data) => request.post('/garments', data)
export const updateGarmentApi = (id, data) => request.put(`/garments/${id}`, data)

export const getAreasApi = () => request.get('/areas')
export const createAreaApi = (data) => request.post('/areas', data)

export const getResponsiblePersonsApi = () => request.get('/responsible-persons')
export const createResponsiblePersonApi = (data) => request.post('/responsible-persons', data)

export const getAvailableTagsApi = () => request.get('/hanging/available-tags')
export const getAvailableGarmentsApi = () => request.get('/hanging/available-garments')
export const createHangingApi = (data) => request.post('/hanging', data)

export const getHangingRecordsApi = (params) => request.get('/hanging-records', { params })
export const getHangingRecordApi = (id) => request.get(`/hanging-records/${id}`)

export const createSwapApi = (data) => request.post('/swap', data)
export const getSwapRecordsApi = (params) => request.get('/swap-records', { params })

export const requestRecoveryApi = (data) => request.post('/recovery/request', data)
export const confirmRecoveryApi = (data) => request.post('/recovery/confirm', data)
export const rejectRecoveryApi = (data) => request.post('/recovery/reject', data)
export const getRecoveryRecordsApi = (params) => request.get('/recovery-records', { params })

export const createMissingPartApi = (data) => request.post('/missing-part', data)
export const handleMissingPartApi = (id, data) => request.post(`/missing-part/${id}/handle`, data)
export const getMissingPartsApi = (params) => request.get('/missing-parts', { params })

export const getOverviewStatsApi = () => request.get('/statistics/overview')

export const getAnomalyTypesApi = () => request.get('/anomaly-tickets/types')
export const getAnomalyTicketsApi = (params) => request.get('/anomaly-tickets', { params })
export const getAnomalyTicketApi = (id) => request.get(`/anomaly-tickets/${id}`)
export const createAnomalyTicketApi = (data) => request.post('/anomaly-tickets', data)
export const handleAnomalyTicketApi = (id, data) => request.post(`/anomaly-tickets/${id}/handle`, data)
export const handoverAnomalyTicketApi = (id, data) => request.post(`/anomaly-tickets/${id}/handover`, data)
export const closeAnomalyTicketApi = (id, data) => request.post(`/anomaly-tickets/${id}/close`, data)
export const createAnomalyFollowUpApi = (id, data) => request.post(`/anomaly-tickets/${id}/follow-up`, data)
export const getAnomalyFollowUpsApi = (id) => request.get(`/anomaly-tickets/${id}/follow-ups`)
export const getHangingAnomaliesApi = (id) => request.get(`/hanging-records/${id}/anomalies`)

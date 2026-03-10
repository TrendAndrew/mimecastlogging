using '../main.bicep'

param environment = 'prod'
param mimecastClientId = '' // Set via pipeline parameter
param mimecastClientSecret = '' // Set via pipeline parameter
param visionOneIngestToken = '' // Set via pipeline parameter
param pollIntervalMs = '300000'

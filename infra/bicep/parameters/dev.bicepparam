using '../main.bicep'

param environment = 'dev'
param mimecastClientId = '' // Set via pipeline parameter
param mimecastClientSecret = '' // Set via pipeline parameter
param visionOneIngestToken = '' // Set via pipeline parameter
param pollIntervalMs = '300000'

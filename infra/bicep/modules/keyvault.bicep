param name string
param location string

@secure()
param mimecastClientId string
@secure()
param mimecastClientSecret string
@secure()
param visionOneIngestToken string

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: name
  location: location
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
  }
}

resource secretMimecastClientId 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'MimecastClientId'
  properties: { value: mimecastClientId }
}

resource secretMimecastClientSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'MimecastClientSecret'
  properties: { value: mimecastClientSecret }
}

resource secretVisionOneToken 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'VisionOneIngestToken'
  properties: { value: visionOneIngestToken }
}

output uri string = keyVault.properties.vaultUri
output name string = keyVault.name

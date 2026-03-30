targetScope = 'resourceGroup'

@description('Environment name')
param environment string = 'dev'

@description('Azure region')
param location string = resourceGroup().location

@description('Container image (e.g. ghcr.io/YOUR_ORG/mimecastlogging:latest)')
param containerImage string

@description('Mimecast Client ID')
@secure()
param mimecastClientId string

@description('Mimecast Client Secret')
@secure()
param mimecastClientSecret string

@description('Vision One Ingest Token')
@secure()
param visionOneIngestToken string

@description('Mimecast Base URL')
param mimecastBaseUrl string = 'https://api.services.mimecast.com'

@description('Vision One Ingest URL')
param visionOneIngestUrl string

@description('Mimecast event types (comma-separated)')
param mimecastEventTypes string = 'receipt,ttp-url,ttp-attachment,ttp-impersonation'

@description('Poll interval in milliseconds')
param pollIntervalMs string = '300000'

@description('Log level')
param logLevel string = 'info'

@description('CPU cores for the container')
param cpuCores string = '0.5'

@description('Memory in GB for the container')
param memoryGb string = '0.5'

var baseName = 'mcvone-${environment}'

resource containerGroup 'Microsoft.ContainerInstance/containerGroups@2023-05-01' = {
  name: '${baseName}-aci'
  location: location
  properties: {
    osType: 'Linux'
    restartPolicy: 'Always'
    containers: [
      {
        name: 'mimecast-forwarder'
        properties: {
          image: containerImage
          resources: {
            requests: {
              cpu: json(cpuCores)
              memoryInGB: json(memoryGb)
            }
          }
          environmentVariables: [
            { name: 'MIMECAST_BASE_URL', value: mimecastBaseUrl }
            { name: 'MIMECAST_CLIENT_ID', secureValue: mimecastClientId }
            { name: 'MIMECAST_CLIENT_SECRET', secureValue: mimecastClientSecret }
            { name: 'MIMECAST_EVENT_TYPES', value: mimecastEventTypes }
            { name: 'VISIONONE_INGEST_URL', value: visionOneIngestUrl }
            { name: 'VISIONONE_INGEST_TOKEN', secureValue: visionOneIngestToken }
            { name: 'POLL_INTERVAL_MS', value: pollIntervalMs }
            { name: 'LOG_LEVEL', value: logLevel }
            { name: 'NODE_ENV', value: 'production' }
          ]
          volumeMounts: [
            {
              name: 'state'
              mountPath: '/app/state'
            }
          ]
        }
      }
    ]
    volumes: [
      {
        name: 'state'
        emptyDir: {}
      }
    ]
  }
}

output containerGroupId string = containerGroup.id
output containerGroupFqdn string = containerGroup.properties.ipAddress.?fqdn ?? ''

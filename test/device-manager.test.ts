import { describe, it, expect } from 'bun:test'
import { createMockLedgerDeviceManager } from '../src/ledger/mock/device.js'
import {
  UserRejectedError,
  DeviceLockedError,
  AppNotOpenError,
} from '../src/shared/errors.js'

describe('createMockLedgerDeviceManager', () => {
  it('should start in disconnected state by default', () => {
    const manager = createMockLedgerDeviceManager()
    expect(manager.state).toBe('disconnected')
    expect(manager.isConnected()).toBe(false)
  })

  it('should start in specified initial state', () => {
    const manager = createMockLedgerDeviceManager({ initialState: 'connected' })
    expect(manager.state).toBe('connected')
    expect(manager.isConnected()).toBe(true)
  })

  it('should connect successfully', async () => {
    const manager = createMockLedgerDeviceManager()
    await manager.connect()
    expect(manager.state).toBe('connected')
    expect(manager.isConnected()).toBe(true)
  })

  it('should disconnect successfully', async () => {
    const manager = createMockLedgerDeviceManager({ initialState: 'connected' })
    await manager.disconnect()
    expect(manager.state).toBe('disconnected')
    expect(manager.isConnected()).toBe(false)
  })

  it('should fail connection when configured', async () => {
    const manager = createMockLedgerDeviceManager({
      failConnect: new Error('USB not available'),
    })

    await expect(manager.connect()).rejects.toThrow('USB not available')
    expect(manager.state).toBe('error')
  })

  it('should return device info', async () => {
    const manager = createMockLedgerDeviceManager({
      initialState: 'connected',
      deviceInfo: {
        model: 'nanoS',
        firmwareVersion: '1.6.1',
      },
    })

    const info = await manager.getDeviceInfo()
    expect(info.model).toBe('nanoS')
    expect(info.firmwareVersion).toBe('1.6.1')
    expect(info.connected).toBe(true)
  })

  it('should return app config when connected', async () => {
    const manager = createMockLedgerDeviceManager({
      initialState: 'connected',
      appConfig: {
        version: '1.9.0',
        supportsEIP712: true,
        blindSigningEnabled: false,
      },
    })

    const config = await manager.getAppConfig()
    expect(config.name).toBe('Ethereum')
    expect(config.version).toBe('1.9.0')
    expect(config.supportsEIP712).toBe(true)
    expect(config.blindSigningEnabled).toBe(false)
  })

  it('should throw when getting app config while disconnected', async () => {
    const manager = createMockLedgerDeviceManager()
    await expect(manager.getAppConfig()).rejects.toBeInstanceOf(AppNotOpenError)
  })

  it('should verify address on device', async () => {
    const manager = createMockLedgerDeviceManager({
      initialState: 'connected',
      addresses: {
        "m/44'/60'/0'/0/0": '0x1234567890123456789012345678901234567890',
      },
    })

    const result = await manager.verifyAddress("m/44'/60'/0'/0/0")
    expect(result.address).toBe('0x1234567890123456789012345678901234567890')
    expect(result.verified).toBe(true)
  })

  it('should auto-connect when verifying while disconnected', async () => {
    const manager = createMockLedgerDeviceManager()
    expect(manager.isConnected()).toBe(false)

    await manager.verifyAddress()
    expect(manager.isConnected()).toBe(true)
  })

  it('should throw UserRejectedError when verification rejected', async () => {
    const manager = createMockLedgerDeviceManager({
      initialState: 'connected',
      failVerify: 'rejected',
    })

    await expect(manager.verifyAddress()).rejects.toBeInstanceOf(UserRejectedError)
  })

  it('should throw DeviceLockedError when device is locked', async () => {
    const manager = createMockLedgerDeviceManager({
      initialState: 'connected',
      failVerify: 'locked',
    })

    await expect(manager.verifyAddress()).rejects.toBeInstanceOf(DeviceLockedError)
  })

  it('should throw AppNotOpenError when app not open', async () => {
    const manager = createMockLedgerDeviceManager({
      initialState: 'connected',
      failVerify: 'app-not-open',
    })

    await expect(manager.verifyAddress()).rejects.toBeInstanceOf(AppNotOpenError)
  })

  it('should notify listeners on state change', async () => {
    const manager = createMockLedgerDeviceManager()
    const states: string[] = []

    manager.onStateChange((state) => {
      states.push(state)
    })

    await manager.connect()
    await manager.disconnect()

    expect(states).toEqual(['connecting', 'connected', 'disconnected'])
  })

  it('should allow removing state change listener', async () => {
    const manager = createMockLedgerDeviceManager()
    const states: string[] = []

    const unsubscribe = manager.onStateChange((state) => {
      states.push(state)
    })

    await manager.connect()
    unsubscribe()
    await manager.disconnect()

    // Should only have states from before unsubscribe
    expect(states).toEqual(['connecting', 'connected'])
  })

  it('should generate deterministic addresses for unknown paths', async () => {
    const manager = createMockLedgerDeviceManager({ initialState: 'connected' })

    const result1 = await manager.verifyAddress("m/44'/60'/0'/0/0")
    const result2 = await manager.verifyAddress("m/44'/60'/0'/0/1")
    const result3 = await manager.verifyAddress("m/44'/60'/0'/0/0")

    // Same path should return same address
    expect(result1.address).toBe(result3.address)
    // Different paths should return different addresses
    expect(result1.address).not.toBe(result2.address)
  })

  it('should return null for getTransport (mock)', () => {
    const manager = createMockLedgerDeviceManager()
    expect(manager.getTransport()).toBe(null)
  })
})

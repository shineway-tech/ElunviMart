const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeMerchantProfile, findMerchantProfileInPayloads } = require('../src/main/merchant-profile');

test('normalizeMerchantProfile keeps the merchant name, avatar and mall id', () => {
  assert.deepEqual(normalizeMerchantProfile({
    displayName: '  橙意家居旗舰店 ',
    avatarUrl: ' https://example.com/avatar.png ',
    mallId: 12345
  }), {
    displayName: '橙意家居旗舰店',
    avatarUrl: 'https://example.com/avatar.png',
    mallId: '12345'
  });
});

test('normalizeMerchantProfile provides safe fallbacks for incomplete page data', () => {
  assert.deepEqual(normalizeMerchantProfile({}), {
    displayName: '',
    avatarUrl: '',
    mallId: ''
  });
});

test('findMerchantProfileInPayloads extracts merchant data from an API response', () => {
  assert.deepEqual(findMerchantProfileInPayloads([{
    result: {
      mall_id: 9988,
      mall_name: '接口店铺',
      mall_logo: 'https://img.example.com/logo.png'
    }
  }]), {
    displayName: '接口店铺',
    avatarUrl: 'https://img.example.com/logo.png',
    mallId: '9988'
  });
});

test('findMerchantProfileInPayloads extracts the real commonMallInfo response shape', () => {
  assert.deepEqual(findMerchantProfileInPayloads([{
    result: { mall_id: 632493180, mall_name: '饭小二小店', logo: 'http://img.example.com/logo.png' }
  }]), {
    displayName: '饭小二小店',
    avatarUrl: 'http://img.example.com/logo.png',
    mallId: '632493180'
  });
});

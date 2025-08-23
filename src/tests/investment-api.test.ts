import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as createSnapshot, DELETE as deleteSnapshot, GET as getSnapshots } from '@/app/api/accounts/[id]/snapshots/route';
import { POST as transferFunds } from '@/app/api/transactions/transfer/route';
import { POST as createTransaction, GET as getTransactions } from '@/app/api/transactions/route';
import { prisma } from '@/lib/prisma';

// Mock the session to return a test user
vi.mock('@/lib/session', () => ({
  getCurrentUser: vi.fn().mockResolvedValue('test-user-id'),
}));

describe('Investment Management API Integration Tests', () => {
  let testAccountId: string;
  let testAccount2Id: string;
  let testUserId: string;

  beforeEach(async () => {
    testUserId = 'test-user-id';
    
    // Create test accounts
    const account1 = await prisma.account.create({
      data: {
        name: 'Test Investment Account',
        accountType: 'INVESTMENT',
        baseCurrency: 'CNY',
        initialBalance: '100000',
        totalDeposits: '0',
        totalWithdrawals: '0',
        status: 'ACTIVE',
        userId: testUserId,
      },
    });

    const account2 = await prisma.account.create({
      data: {
        name: 'Test Savings Account',
        accountType: 'SAVINGS',
        baseCurrency: 'CNY',
        initialBalance: '50000',
        totalDeposits: '0',
        totalWithdrawals: '0',
        status: 'ACTIVE',
        userId: testUserId,
      },
    });

    testAccountId = account1.id;
    testAccount2Id = account2.id;
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.transaction.deleteMany({
      where: { accountId: { in: [testAccountId, testAccount2Id] } },
    });
    
    await prisma.valuationSnapshot.deleteMany({
      where: { accountId: testAccountId },
    });
    
    await prisma.account.deleteMany({
      where: { id: { in: [testAccountId, testAccount2Id] } },
    });
  });

  describe('Valuation Snapshots API', () => {
    it('should create a new valuation snapshot', async () => {
      const request = new NextRequest('http://localhost/test', {
        method: 'POST',
        body: JSON.stringify({
          totalValue: 150000,
          asOf: '2024-01-15',
        }),
      });

      const response = await createSnapshot(request, {
        params: Promise.resolve({ id: testAccountId }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.totalValue).toBe('150000');
      expect(data.message).toBe('估值已添加');
    });

    it('should update existing valuation snapshot for same date', async () => {
      // Create initial snapshot
      await prisma.valuationSnapshot.create({
        data: {
          accountId: testAccountId,
          asOf: new Date('2024-01-15'),
          totalValue: '140000',
        },
      });

      const request = new NextRequest('http://localhost/test', {
        method: 'POST',
        body: JSON.stringify({
          totalValue: 150000,
          asOf: '2024-01-15',
        }),
      });

      const response = await createSnapshot(request, {
        params: Promise.resolve({ id: testAccountId }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.totalValue).toBe('150000');
      expect(data.message).toBe('估值已更新');
    });

    it('should get valuation snapshots with pagination', async () => {
      // Create test snapshots
      await prisma.valuationSnapshot.createMany({
        data: [
          {
            accountId: testAccountId,
            asOf: new Date('2024-01-15'),
            totalValue: '150000',
          },
          {
            accountId: testAccountId,
            asOf: new Date('2024-01-10'),
            totalValue: '140000',
          },
        ],
      });

      const request = new NextRequest('http://localhost/test?page=1&pageSize=10');

      const response = await getSnapshots(request, {
        params: Promise.resolve({ id: testAccountId }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);
      expect(data.pagination.total).toBe(2);
    });

    it('should delete a valuation snapshot', async () => {
      // Create a snapshot to delete
      const snapshot = await prisma.valuationSnapshot.create({
        data: {
          accountId: testAccountId,
          asOf: new Date('2024-01-15'),
          totalValue: '150000',
        },
      });

      const request = new NextRequest('http://localhost/test', {
        method: 'DELETE',
        body: JSON.stringify({
          snapshotId: snapshot.id,
        }),
      });

      const response = await deleteSnapshot(request, {
        params: Promise.resolve({ id: testAccountId }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('快照已删除');

      // Verify snapshot is deleted
      const deletedSnapshot = await prisma.valuationSnapshot.findUnique({
        where: { id: snapshot.id },
      });
      expect(deletedSnapshot).toBeNull();
    });

    it('should validate snapshot data', async () => {
      const request = new NextRequest('http://localhost/test', {
        method: 'POST',
        body: JSON.stringify({
          totalValue: -1000, // Invalid: negative value
          asOf: '2024-01-15',
        }),
      });

      const response = await createSnapshot(request, {
        params: Promise.resolve({ id: testAccountId }),
      });

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Transactions API', () => {
    it('should create a deposit transaction', async () => {
      const request = new NextRequest('http://localhost/test', {
        method: 'POST',
        body: JSON.stringify({
          accountId: testAccountId,
          type: 'DEPOSIT',
          tradeDate: '2024-01-15',
          cashAmount: 10000,
          currency: 'CNY',
          note: 'Test deposit',
        }),
      });

      const response = await createTransaction(request);
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();

      // Verify account balance was updated
      const account = await prisma.account.findUnique({
        where: { id: testAccountId },
      });
      expect(Number(account?.totalDeposits)).toBe(10000);
    });

    it('should create a withdrawal transaction', async () => {
      const request = new NextRequest('http://localhost/test', {
        method: 'POST',
        body: JSON.stringify({
          accountId: testAccountId,
          type: 'WITHDRAW',
          tradeDate: '2024-01-15',
          cashAmount: 5000,
          currency: 'CNY',
          note: 'Test withdrawal',
        }),
      });

      const response = await createTransaction(request);
      const data = await response.json();
      
      expect(data.success).toBe(true);

      // Verify account balance was updated
      const account = await prisma.account.findUnique({
        where: { id: testAccountId },
      });
      expect(Number(account?.totalWithdrawals)).toBe(5000);
    });

    it('should get transactions for an account', async () => {
      // Create test transactions
      await prisma.transaction.createMany({
        data: [
          {
            accountId: testAccountId,
            type: 'DEPOSIT',
            tradeDate: new Date('2024-01-15'),
            amount: '10000',
            currency: 'CNY',
            note: 'Test deposit',
          },
          {
            accountId: testAccountId,
            type: 'WITHDRAW',
            tradeDate: new Date('2024-01-10'),
            amount: '5000',
            currency: 'CNY',
            note: 'Test withdrawal',
          },
        ],
      });

      const request = new NextRequest(`http://localhost/test?accountId=${testAccountId}&page=1&pageSize=10`);

      const response = await getTransactions(request);
      const responseData = await response.json();

      expect(responseData.success).toBe(true);
      expect(responseData.data).toHaveLength(2);
      expect(responseData.pagination.total).toBe(2);
    });
  });

  describe('Transfer API', () => {
    it('should create transfer between accounts', async () => {
      const request = new NextRequest('http://localhost/test', {
        method: 'POST',
        body: JSON.stringify({
          fromAccountId: testAccountId,
          toAccountId: testAccount2Id,
          amount: 15000,
          tradeDate: '2024-01-15',
          note: 'Test transfer',
          currency: 'CNY',
        }),
      });

      const response = await transferFunds(request);
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(data.data.fromId).toBeDefined();
      expect(data.data.toId).toBeDefined();

      // Verify both transactions were created
      const transactions = await prisma.transaction.findMany({
        where: {
          accountId: { in: [testAccountId, testAccount2Id] },
          amount: '15000',
        },
      });

      expect(transactions).toHaveLength(2);
      
      const outTransaction = transactions.find(t => t.type === 'TRANSFER_OUT');
      const inTransaction = transactions.find(t => t.type === 'TRANSFER_IN');
      
      expect(outTransaction).toBeDefined();
      expect(inTransaction).toBeDefined();
      expect(outTransaction?.accountId).toBe(testAccountId);
      expect(inTransaction?.accountId).toBe(testAccount2Id);
    });

    it('should validate transfer data', async () => {
      const request = new NextRequest('http://localhost/test', {
        method: 'POST',
        body: JSON.stringify({
          fromAccountId: 'invalid-uuid',
          toAccountId: testAccount2Id,
          amount: 15000,
          tradeDate: '2024-01-15',
          currency: 'CNY',
        }),
      });

      const response = await transferFunds(request);
      const data = await response.json();
      
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject transfer with non-existent accounts', async () => {
      const request = new NextRequest('http://localhost/test', {
        method: 'POST',
        body: JSON.stringify({
          fromAccountId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          toAccountId: testAccount2Id,
          amount: 15000,
          tradeDate: '2024-01-15',
          currency: 'CNY',
        }),
      });

      const response = await transferFunds(request);
      const data = await response.json();
      
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const request = new NextRequest('http://localhost/test', {
        method: 'POST',
        body: 'invalid json',
      });

      const response = await createSnapshot(request, {
        params: Promise.resolve({ id: testAccountId }),
      });

      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('should handle missing required fields', async () => {
      const request = new NextRequest('http://localhost/test', {
        method: 'POST',
        body: JSON.stringify({
          // Missing totalValue and asOf
        }),
      });

      const response = await createSnapshot(request, {
        params: Promise.resolve({ id: testAccountId }),
      });

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
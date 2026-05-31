export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Vesta BDApps REST Simulator',
    version: '1.0.0',
    description:
      'Local BDApps-compatible simulator for OTP, subscription, and CAAS development flows.',
  },
  servers: [{ url: 'http://localhost:7010' }],
  tags: [
    { name: 'health' },
    { name: 'otp' },
    { name: 'subscription' },
    { name: 'caas' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['health'],
        summary: 'Simulator health',
        responses: {
          '200': {
            description: 'Simulator is healthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
        },
      },
    },
    '/otp/request': {
      post: {
        tags: ['otp'],
        summary: 'Request OTP',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/OtpRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'BDApps-style OTP request response',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OtpRequestResponse' },
              },
            },
          },
        },
      },
    },
    '/otp/verify': {
      post: {
        tags: ['otp'],
        summary: 'Verify OTP',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/OtpVerifyRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'BDApps-style OTP verification response',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OtpVerifyResponse' },
              },
            },
          },
        },
      },
    },
    '/subscription/getStatus': {
      post: {
        tags: ['subscription'],
        summary: 'Get subscriber status',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SubscriberRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'BDApps-style subscription status response',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SubscriptionStatusResponse' },
              },
            },
          },
        },
      },
    },
    '/subscription/send': {
      post: {
        tags: ['subscription'],
        summary: 'Register or unregister subscriber',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SubscriptionSendRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'BDApps-style subscription mutation response',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SubscriptionStatusResponse' },
              },
            },
          },
        },
      },
    },
    '/subscription/query-base': {
      post: {
        tags: ['subscription'],
        summary: 'Registered subscriber count',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AuthRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'BDApps-style base size response',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/BaseSizeResponse' },
              },
            },
          },
        },
      },
    },
    '/caas/get/balance': {
      post: {
        tags: ['caas'],
        summary: 'Query CAAS balance',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CaasBalanceRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'BDApps-style CAAS balance response',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CaasBalanceResponse' },
              },
            },
          },
        },
      },
    },
    '/caas/direct/debit': {
      post: {
        tags: ['caas'],
        summary: 'Direct debit subscriber balance',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CaasDebitRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'BDApps-style CAAS debit response',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CaasDebitResponse' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      AuthRequest: {
        type: 'object',
        required: ['applicationId', 'password'],
        properties: {
          applicationId: { type: 'string', example: 'APP_SIMULATOR' },
          password: { type: 'string', example: 'simulator_password' },
        },
      },
      SubscriberRequest: {
        allOf: [
          { $ref: '#/components/schemas/AuthRequest' },
          {
            type: 'object',
            required: ['subscriberId'],
            properties: {
              subscriberId: { type: 'string', example: 'tel:8801812345678' },
            },
          },
        ],
      },
      OtpRequest: {
        allOf: [
          { $ref: '#/components/schemas/SubscriberRequest' },
          {
            type: 'object',
            properties: {
              applicationHash: { type: 'string', example: 'abcdefgh' },
            },
          },
        ],
      },
      OtpRequestResponse: {
        type: 'object',
        properties: {
          version: { type: 'string', example: '1.0' },
          statusCode: { type: 'string', example: 'S1000' },
          referenceNo: { type: 'string', example: 'REF-1700000000000' },
          debugOtp: { type: 'string', example: '420420' },
          statusDetail: { type: 'string', example: 'Success' },
        },
      },
      OtpVerifyRequest: {
        allOf: [
          { $ref: '#/components/schemas/AuthRequest' },
          {
            type: 'object',
            required: ['referenceNo', 'otp'],
            properties: {
              referenceNo: { type: 'string' },
              otp: { type: 'string', example: '420420' },
            },
          },
        ],
      },
      OtpVerifyResponse: {
        type: 'object',
        properties: {
          version: { type: 'string', example: '1.0' },
          statusCode: { type: 'string', example: 'S1000' },
          subscriptionStatus: { type: 'string', example: 'REGISTERED' },
          statusDetail: { type: 'string', example: 'Success' },
          subscriberId: { type: 'string', example: 'tel:8801812345678' },
        },
      },
      SubscriptionSendRequest: {
        allOf: [
          { $ref: '#/components/schemas/SubscriberRequest' },
          {
            type: 'object',
            required: ['action'],
            properties: {
              action: { type: 'string', enum: ['0', '1'], example: '1' },
            },
          },
        ],
      },
      SubscriptionStatusResponse: {
        type: 'object',
        properties: {
          version: { type: 'string', example: '1.0.' },
          statusCode: { type: 'string', example: 'S1000' },
          statusDetail: { type: 'string', example: 'Request was successfully processed' },
          subscriptionStatus: { type: 'string', example: 'REGISTERED' },
        },
      },
      BaseSizeResponse: {
        type: 'object',
        properties: {
          baseSize: { type: 'string', example: '1' },
          version: { type: 'string', example: '1.0.' },
          statusCode: { type: 'string', example: 'S1000' },
          statusDetail: { type: 'string', example: 'Success.' },
        },
      },
      CaasBalanceRequest: {
        allOf: [
          { $ref: '#/components/schemas/SubscriberRequest' },
          {
            type: 'object',
            properties: {
              paymentInstrumentName: { type: 'string', example: 'MobileAccount' },
              currency: { type: 'string', example: 'BDT' },
            },
          },
        ],
      },
      CaasBalanceResponse: {
        type: 'object',
        properties: {
          accountType: { type: 'string', example: 'Pre Paid' },
          accountStatus: { type: 'string', example: 'Active' },
          statusCode: { type: 'string', example: 'S1000' },
          statusDetail: { type: 'string', example: 'Success.' },
          chargeableBalance: { type: 'string', example: '300.0' },
        },
      },
      CaasDebitRequest: {
        allOf: [
          { $ref: '#/components/schemas/SubscriberRequest' },
          {
            type: 'object',
            required: ['externalTrxId', 'amount'],
            properties: {
              externalTrxId: { type: 'string' },
              amount: { type: 'number', example: 5 },
              paymentInstrumentName: { type: 'string', example: 'PaymentInstrument' },
              currency: { type: 'string', example: 'BDT' },
            },
          },
        ],
      },
      CaasDebitResponse: {
        type: 'object',
        properties: {
          externalTrxId: { type: 'string' },
          internalTrxId: { type: 'string' },
          referenceId: { type: 'string' },
          timeStamp: { type: 'string' },
          statusCode: { type: 'string', example: 'S1000' },
          statusDetail: { type: 'string', example: 'Success.' },
        },
      },
      HealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'ok' },
          simulator: { type: 'string', example: 'vesta-bdapps-rest-simulator' },
          subscribers: { type: 'number', example: 1 },
          transactions: { type: 'number', example: 0 },
        },
      },
    },
  },
} as const;

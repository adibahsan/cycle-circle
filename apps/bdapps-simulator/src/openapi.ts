type CallbackTargets = {
  smsReceive: string;
  smsReport: string;
  ussdReceive: string;
  subscriptionNotify: string;
  caasNotify: string;
};

type OpenApiOptions = {
  publicBaseUrl?: string;
  callbackBaseUrl?: string;
};

const DEFAULT_PUBLIC_BASE_URL = 'http://localhost:7010';
const CALLBACK_PATHS = {
  smsReceive: '/api/webhooks/sms/receive',
  smsReport: '/api/webhooks/sms/report',
  ussdReceive: '/api/webhooks/ussd/receive',
  subscriptionNotify: '/api/webhooks/subscription/notify',
  caasNotify: '/api/webhooks/caas/notify',
} as const;

export function createOpenApiSpec(options: OpenApiOptions = {}) {
  const publicBaseUrl = trimTrailingSlash(options.publicBaseUrl || DEFAULT_PUBLIC_BASE_URL);
  const callbackTargets = buildCallbackTargets(options.callbackBaseUrl);

  return {
  openapi: '3.0.3',
  info: {
    title: 'Vesta BDApps REST Simulator',
    version: '1.0.0',
    description:
      [
        'Local BDApps-compatible simulator for OTP, subscription, and CAAS development flows.',
        '',
        'Callback URL configuration for apps/web:',
        '- BDAPPS_WEBHOOK_BASE_URL derives all real /api/webhooks/* callback URLs.',
        '- Per-route variables can override a single callback URL: BDAPPS_SMS_RECEIVE_WEBHOOK_URL, BDAPPS_SMS_REPORT_WEBHOOK_URL, BDAPPS_USSD_RECEIVE_WEBHOOK_URL, BDAPPS_SUBSCRIPTION_NOTIFY_WEBHOOK_URL, BDAPPS_CAAS_NOTIFY_WEBHOOK_URL.',
        '- BDAPPS_SIMULATOR_CALLBACK_BASE_URL is the development fallback for local simulator callbacks.',
      ].join('\n'),
  },
  servers: [{ url: publicBaseUrl }],
  'x-vesta-callback-targets': callbackTargets,
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
          publicBaseUrl: { type: 'string', example: 'http://127.0.0.1:7010' },
          callbackBaseUrl: { type: 'string', nullable: true, example: 'http://app:3000' },
        },
      },
    },
  },
  } as const;
}

export const openApiSpec = createOpenApiSpec();

function buildCallbackTargets(callbackBaseUrl?: string): CallbackTargets | null {
  if (!callbackBaseUrl) return null;

  const baseUrl = trimTrailingSlash(callbackBaseUrl);
  return {
    smsReceive: joinUrl(baseUrl, CALLBACK_PATHS.smsReceive),
    smsReport: joinUrl(baseUrl, CALLBACK_PATHS.smsReport),
    ussdReceive: joinUrl(baseUrl, CALLBACK_PATHS.ussdReceive),
    subscriptionNotify: joinUrl(baseUrl, CALLBACK_PATHS.subscriptionNotify),
    caasNotify: joinUrl(baseUrl, CALLBACK_PATHS.caasNotify),
  };
}

function joinUrl(baseUrl: string, path: string) {
  return new URL(path.replace(/^\/+/, ''), `${baseUrl}/`).toString().replace(/\/+$/, '');
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

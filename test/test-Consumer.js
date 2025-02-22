const { toBeType } = require('jest-tobetype');
const mediasoup = require('../');
const { createWorker } = mediasoup;
const { UnsupportedError } = require('../lib/errors');

expect.extend({ toBeType });

let worker;
let router;
let transport1;
let transport2;
let audioProducer;
let videoProducer;
let audioConsumer;
let videoConsumer;

const mediaCodecs =
[
	{
		kind       : 'audio',
		mimeType   : 'audio/opus',
		clockRate  : 48000,
		channels   : 2,
		parameters :
		{
			foo : 'bar'
		}
	},
	{
		kind      : 'video',
		mimeType  : 'video/VP8',
		clockRate : 90000
	},
	{
		kind       : 'video',
		mimeType   : 'video/H264',
		clockRate  : 90000,
		parameters :
		{
			'level-asymmetry-allowed' : 1,
			'packetization-mode'      : 1,
			'profile-level-id'        : '4d0032',
			foo                       : 'bar'
		}
	}
];

const audioProducerParameters =
{
	kind          : 'audio',
	rtpParameters :
	{
		mid    : 'AUDIO',
		codecs :
		[
			{
				mimeType    : 'audio/opus',
				payloadType : 111,
				clockRate   : 48000,
				channels    : 2,
				parameters  :
				{
					useinbandfec : 1,
					usedtx       : 1,
					foo          : 222.222,
					bar          : '333'
				}
			}
		],
		headerExtensions :
		[
			{
				uri : 'urn:ietf:params:rtp-hdrext:sdes:mid',
				id  : 10
			},
			{
				uri : 'urn:ietf:params:rtp-hdrext:ssrc-audio-level',
				id  : 12
			}
		],
		encodings : [ { ssrc: 11111111 } ],
		rtcp      :
		{
			cname : 'FOOBAR'
		}
	},
	appData : { foo: 1, bar: '2' }
};

const videoProducerParameters =
{
	kind          : 'video',
	rtpParameters :
	{
		mid    : 'VIDEO',
		codecs :
		[
			{
				mimeType    : 'video/h264',
				payloadType : 112,
				clockRate   : 90000,
				parameters  :
				{
					'packetization-mode' : 1,
					'profile-level-id'   : '4d0032'
				},
				rtcpFeedback :
				[
					{ type: 'nack' },
					{ type: 'nack', parameter: 'pli' },
					{ type: 'goog-remb' }
				]
			},
			{
				mimeType    : 'video/rtx',
				payloadType : 113,
				clockRate   : 90000,
				parameters  : { apt: 112 }
			}
		],
		headerExtensions :
		[
			{
				uri : 'urn:ietf:params:rtp-hdrext:sdes:mid',
				id  : 10
			},
			{
				uri : 'urn:3gpp:video-orientation',
				id  : 13
			}
		],
		encodings :
		[
			{ ssrc: 22222222, rtx: { ssrc: 22222223 } },
			{ ssrc: 22222224, rtx: { ssrc: 22222225 } },
			{ ssrc: 22222226, rtx: { ssrc: 22222227 } },
			{ ssrc: 22222228, rtx: { ssrc: 22222229 } }
		],
		rtcp :
		{
			cname : 'FOOBAR'
		}
	},
	appData : { foo: 1, bar: '2' }
};

const consumerDeviceCapabilities =
{
	codecs :
	[
		{
			mimeType             : 'audio/opus',
			kind                 : 'audio',
			clockRate            : 48000,
			preferredPayloadType : 100,
			channels             : 2
		},
		{
			mimeType             : 'video/H264',
			kind                 : 'video',
			clockRate            : 90000,
			preferredPayloadType : 101,
			rtcpFeedback         :
			[
				{ type: 'nack' },
				{ type: 'nack', parameter: 'pli' },
				{ type: 'ccm', parameter: 'fir' },
				{ type: 'goog-remb' }
			],
			parameters :
			{
				'level-asymmetry-allowed' : 1,
				'packetization-mode'      : 1,
				'profile-level-id'        : '4d0032'
			}
		},
		{
			mimeType             : 'video/rtx',
			kind                 : 'video',
			clockRate            : 90000,
			preferredPayloadType : 102,
			rtcpFeedback         : [],
			parameters           :
			{
				apt : 101
			}
		}
	],
	headerExtensions :
	[
		{
			kind             : 'audio',
			uri              : 'urn:ietf:params:rtp-hdrext:sdes:mid',
			preferredId      : 1,
			preferredEncrypt : false
		},
		{
			kind             : 'video',
			uri              : 'urn:ietf:params:rtp-hdrext:sdes:mid',
			preferredId      : 1,
			preferredEncrypt : false
		},
		{
			kind             : 'video',
			uri              : 'urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id',
			preferredId      : 2,
			preferredEncrypt : false
		},
		{
			kind             : 'audio',
			uri              : 'http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time', // eslint-disable-line max-len
			preferredId      : 4,
			preferredEncrypt : false
		},
		{
			kind             : 'video',
			uri              : 'http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time', // eslint-disable-line max-len
			preferredId      : 4,
			preferredEncrypt : false
		},
		{
			kind             : 'audio',
			uri              : 'urn:ietf:params:rtp-hdrext:ssrc-audio-level',
			preferredId      : 10,
			preferredEncrypt : false
		},
		{
			kind             : 'video',
			uri              : 'urn:3gpp:video-orientation',
			preferredId      : 11,
			preferredEncrypt : false
		},
		{
			kind             : 'video',
			uri              : 'urn:ietf:params:rtp-hdrext:toffset',
			preferredId      : 12,
			preferredEncrypt : false
		}
	],
	fecMechanisms : []
};

beforeAll(async () =>
{
	worker = await createWorker();
	router = await worker.createRouter({ mediaCodecs });
	transport1 = await router.createWebRtcTransport(
		{
			listenIps : [ '127.0.0.1' ]
		});
	transport2 = await router.createWebRtcTransport(
		{
			listenIps : [ '127.0.0.1' ]
		});
	audioProducer = await transport1.produce(audioProducerParameters);
	videoProducer = await transport1.produce(videoProducerParameters);

	// Pause the videoProducer.
	await videoProducer.pause();
});

afterAll(() => worker.close());

test('transport.consume() succeeds', async () =>
{
	const onObserverNewConsumer1 = jest.fn();

	transport2.observer.once('newconsumer', onObserverNewConsumer1);

	expect(router.canConsume(
		{
			producerId      : audioProducer.id,
			rtpCapabilities : consumerDeviceCapabilities
		}))
		.toBe(true);

	audioConsumer = await transport2.consume(
		{
			producerId      : audioProducer.id,
			rtpCapabilities : consumerDeviceCapabilities,
			appData         : { baz: 'LOL' }
		});

	expect(onObserverNewConsumer1).toHaveBeenCalledTimes(1);
	expect(onObserverNewConsumer1).toHaveBeenCalledWith(audioConsumer);
	expect(audioConsumer.id).toBeType('string');
	expect(audioConsumer.producerId).toBe(audioProducer.id);
	expect(audioConsumer.closed).toBe(false);
	expect(audioConsumer.kind).toBe('audio');
	expect(audioConsumer.rtpParameters).toBeType('object');
	expect(audioConsumer.rtpParameters.mid).toBe(undefined);
	expect(audioConsumer.rtpParameters.codecs.length).toBe(1);
	expect(audioConsumer.rtpParameters.codecs[0]).toEqual(
		{
			mimeType    : 'audio/opus',
			clockRate   : 48000,
			payloadType : 100,
			channels    : 2,
			parameters  :
			{
				useinbandfec : 1,
				usedtx       : 1,
				foo          : 222.222,
				bar          : '333'
			},
			rtcpFeedback : []
		});
	expect(audioConsumer.type).toBe('simple');
	expect(audioConsumer.paused).toBe(false);
	expect(audioConsumer.producerPaused).toBe(false);
	expect(audioConsumer.score).toEqual({ score: 10, producerScore: 0 });
	expect(audioConsumer.currentLayers).toBe(null);
	expect(audioConsumer.appData).toEqual({ baz: 'LOL' });

	await expect(router.dump())
		.resolves
		.toMatchObject(
			{
				mapProducerIdConsumerIds : { [audioProducer.id]: [ audioConsumer.id ] },
				mapConsumerIdProducerId  : { [audioConsumer.id]: audioProducer.id }
			});

	await expect(transport2.dump())
		.resolves
		.toMatchObject(
			{
				id          : transport2.id,
				producerIds : [],
				consumerIds : [ audioConsumer.id ]
			});

	const onObserverNewConsumer2 = jest.fn();

	transport2.observer.once('newconsumer', onObserverNewConsumer2);

	expect(router.canConsume(
		{
			producerId      : videoProducer.id,
			rtpCapabilities : consumerDeviceCapabilities
		}))
		.toBe(true);

	videoConsumer = await transport2.consume(
		{
			producerId      : videoProducer.id,
			rtpCapabilities : consumerDeviceCapabilities,
			paused          : true,
			preferredLayers : { spatialLayer: 12 },
			appData         : { baz: 'LOL' }
		});

	expect(onObserverNewConsumer2).toHaveBeenCalledTimes(1);
	expect(onObserverNewConsumer2).toHaveBeenCalledWith(videoConsumer);
	expect(videoConsumer.id).toBeType('string');
	expect(videoConsumer.producerId).toBe(videoProducer.id);
	expect(videoConsumer.closed).toBe(false);
	expect(videoConsumer.kind).toBe('video');
	expect(videoConsumer.rtpParameters).toBeType('object');
	expect(videoConsumer.rtpParameters.mid).toBe(undefined);
	expect(videoConsumer.rtpParameters.codecs.length).toBe(2);
	expect(videoConsumer.rtpParameters.codecs[0]).toEqual(
		{
			mimeType    : 'video/H264',
			clockRate   : 90000,
			payloadType : 103,
			parameters  :
			{
				'packetization-mode' : 1,
				'profile-level-id'   : '4d0032'
			},
			rtcpFeedback :
			[
				{ type: 'nack' },
				{ type: 'nack', parameter: 'pli' },
				{ type: 'ccm', parameter: 'fir' },
				{ type: 'goog-remb' }
			]
		});
	expect(videoConsumer.rtpParameters.codecs[1]).toEqual(
		{
			mimeType     : 'video/rtx',
			clockRate    : 90000,
			payloadType  : 104,
			parameters   : { apt: 103 },
			rtcpFeedback : []
		});
	expect(videoConsumer.type).toBe('simulcast');
	expect(videoConsumer.paused).toBe(true);
	expect(videoConsumer.producerPaused).toBe(true);
	expect(videoConsumer.score).toEqual({ score: 10, producerScore: 0 });
	expect(videoConsumer.currentLayers).toBe(null);
	expect(videoConsumer.appData).toEqual({ baz: 'LOL' });

	await expect(router.dump())
		.resolves
		.toMatchObject(
			{
				mapProducerIdConsumerIds :
				{
					[audioProducer.id] : [ audioConsumer.id ],
					[videoProducer.id] : [ videoConsumer.id ]
				},
				mapConsumerIdProducerId :
				{
					[audioConsumer.id] : audioProducer.id,
					[videoConsumer.id] : videoProducer.id
				}
			});

	await expect(transport2.dump())
		.resolves
		.toMatchObject(
			{
				id          : transport2.id,
				producerIds : [],
				consumerIds : expect.arrayContaining([ audioConsumer.id, videoConsumer.id ])
			});
}, 2000);

test('transport.consume() with incompatible rtpCapabilities rejects with UnsupportedError', async () =>
{
	let invalidDeviceCapabilities;

	invalidDeviceCapabilities =
	{
		codecs :
		[
			{
				kind                 : 'audio',
				mimeType             : 'audio/ISAC',
				clockRate            : 32000,
				preferredPayloadType : 100,
				channels             : 1
			}
		],
		headerExtensions : []
	};

	expect(router.canConsume(
		{ producerId: audioProducer.id, rtpCapabilities: invalidDeviceCapabilities }))
		.toBe(false);

	await expect(transport2.consume(
		{
			producerId      : audioProducer.id,
			rtpCapabilities : invalidDeviceCapabilities
		}))
		.rejects
		.toThrow(UnsupportedError);

	invalidDeviceCapabilities =
	{
		codecs           : [],
		headerExtensions : []
	};

	expect(router.canConsume(
		{ producerId: audioProducer.id, rtpCapabilities: invalidDeviceCapabilities }))
		.toBe(false);

	await expect(transport2.consume(
		{
			producerId      : audioProducer.id,
			rtpCapabilities : invalidDeviceCapabilities
		}))
		.rejects
		.toThrow(UnsupportedError);
}, 2000);

test('consumer.dump() succeeds', async () =>
{
	let data;

	data = await audioConsumer.dump();

	expect(data.id).toBe(audioConsumer.id);
	expect(data.kind).toBe(audioConsumer.kind);
	expect(data.rtpParameters).toBeType('object');
	expect(data.rtpParameters.codecs).toBeType('array');
	expect(data.rtpParameters.codecs.length).toBe(1);
	expect(data.rtpParameters.codecs[0].mimeType).toBe('audio/opus');
	expect(data.rtpParameters.codecs[0].payloadType).toBe(100);
	expect(data.rtpParameters.codecs[0].clockRate).toBe(48000);
	expect(data.rtpParameters.codecs[0].channels).toBe(2);
	expect(data.rtpParameters.codecs[0].parameters)
		.toEqual(
			{
				useinbandfec : 1,
				usedtx       : 1,
				foo          : 222.222,
				bar          : '333'
			});
	expect(data.rtpParameters.codecs[0].rtcpFeedback).toEqual([]);
	expect(data.rtpParameters.headerExtensions).toBeType('array');
	expect(data.rtpParameters.headerExtensions.length).toBe(2);
	expect(data.rtpParameters.headerExtensions).toEqual(
		[
			{
				uri        : 'http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time',
				id         : 4,
				parameters : {},
				encrypt    : false
			},
			{
				uri        : 'urn:ietf:params:rtp-hdrext:ssrc-audio-level',
				id         : 10,
				parameters : {},
				encrypt    : false
			}
		]);
	expect(data.rtpParameters.encodings).toBeType('array');
	expect(data.rtpParameters.encodings.length).toBe(1);
	expect(data.rtpParameters.encodings).toEqual(
		[
			{
				codecPayloadType : 100,
				ssrc             : audioConsumer.rtpParameters.encodings[0].ssrc
			}
		]);
	expect(data.type).toBe('simple');
	expect(data.consumableRtpEncodings).toBeType('array');
	expect(data.consumableRtpEncodings.length).toBe(1);
	expect(data.consumableRtpEncodings).toEqual(
		[
			{ ssrc: audioProducer.consumableRtpParameters.encodings[0].ssrc }
		]);
	expect(data.supportedCodecPayloadTypes).toEqual([ 100 ]);
	expect(data.paused).toBe(false);
	expect(data.producerPaused).toBe(false);

	data = await videoConsumer.dump();

	expect(data.id).toBe(videoConsumer.id);
	expect(data.kind).toBe(videoConsumer.kind);
	expect(data.rtpParameters).toBeType('object');
	expect(data.rtpParameters.codecs).toBeType('array');
	expect(data.rtpParameters.codecs.length).toBe(2);
	expect(data.rtpParameters.codecs[0].mimeType).toBe('video/H264');
	expect(data.rtpParameters.codecs[0].payloadType).toBe(103);
	expect(data.rtpParameters.codecs[0].clockRate).toBe(90000);
	expect(data.rtpParameters.codecs[0].channels).toBe(undefined);
	expect(data.rtpParameters.codecs[0].parameters)
		.toEqual(
			{
				'packetization-mode' : 1,
				'profile-level-id'   : '4d0032'
			});
	expect(data.rtpParameters.codecs[0].rtcpFeedback).toEqual(
		[
			{ type: 'nack' },
			{ type: 'nack', parameter: 'pli' },
			{ type: 'ccm', parameter: 'fir' },
			{ type: 'goog-remb' }
		]);
	expect(data.rtpParameters.headerExtensions).toBeType('array');
	expect(data.rtpParameters.headerExtensions.length).toBe(3);
	expect(data.rtpParameters.headerExtensions).toEqual(
		[
			{
				uri        : 'http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time',
				id         : 4,
				parameters : {},
				encrypt    : false
			},
			{
				uri        : 'urn:3gpp:video-orientation',
				id         : 11,
				parameters : {},
				encrypt    : false
			},
			{
				uri        : 'urn:ietf:params:rtp-hdrext:toffset',
				id         : 12,
				parameters : {},
				encrypt    : false
			}
		]);
	expect(data.rtpParameters.encodings).toBeType('array');
	expect(data.rtpParameters.encodings.length).toBe(1);
	expect(data.rtpParameters.encodings).toEqual(
		[
			{
				codecPayloadType : 103,
				ssrc             : videoConsumer.rtpParameters.encodings[0].ssrc,
				rtx              :
				{
					ssrc : videoConsumer.rtpParameters.encodings[0].rtx.ssrc
				},
				scalabilityMode : 'S4T1',
				spatialLayers   : 4,
				temporalLayers  : 1
			}
		]);
	expect(data.consumableRtpEncodings).toBeType('array');
	expect(data.consumableRtpEncodings.length).toBe(4);
	expect(data.consumableRtpEncodings).toEqual(
		[
			{ ssrc: videoProducer.consumableRtpParameters.encodings[0].ssrc },
			{ ssrc: videoProducer.consumableRtpParameters.encodings[1].ssrc },
			{ ssrc: videoProducer.consumableRtpParameters.encodings[2].ssrc },
			{ ssrc: videoProducer.consumableRtpParameters.encodings[3].ssrc }
		]);
	expect(data.supportedCodecPayloadTypes).toEqual([ 103 ]);
	expect(data.paused).toBe(true);
	expect(data.producerPaused).toBe(true);
}, 2000);

test('consumer.getStats() succeeds', async () =>
{
	await expect(audioConsumer.getStats())
		.resolves
		.toEqual(
			[
				expect.objectContaining(
					{
						type     : 'outbound-rtp',
						kind     : 'audio',
						mimeType : 'audio/opus',
						ssrc     : audioConsumer.rtpParameters.encodings[0].ssrc
					})
			]);

	await expect(videoConsumer.getStats())
		.resolves
		.toEqual(
			[
				expect.objectContaining(
					{
						type     : 'outbound-rtp',
						kind     : 'video',
						mimeType : 'video/H264',
						ssrc     : videoConsumer.rtpParameters.encodings[0].ssrc
					})
			]);
}, 2000);

test('consumer.pause() and resume() succeed', async () =>
{
	await audioConsumer.pause();
	expect(audioConsumer.paused).toBe(true);

	await expect(audioConsumer.dump())
		.resolves
		.toMatchObject({ paused: true });

	await audioConsumer.resume();
	expect(audioConsumer.paused).toBe(false);

	await expect(audioConsumer.dump())
		.resolves
		.toMatchObject({ paused: false });
}, 2000);

test('Consumer emits "producerpause" and "producerresume"', async () =>
{
	await new Promise((resolve) =>
	{
		audioConsumer.on('producerpause', resolve);
		audioProducer.pause();
	});

	expect(audioConsumer.paused).toBe(false);
	expect(audioConsumer.producerPaused).toBe(true);

	await new Promise((resolve) =>
	{
		audioConsumer.on('producerresume', resolve);
		audioProducer.resume();
	});

	expect(audioConsumer.paused).toBe(false);
	expect(audioConsumer.producerPaused).toBe(false);
}, 2000);

test('Consumer emits "score"', async () =>
{
	// Private API.
	const channel = audioConsumer._channel;
	const onScore = jest.fn();

	audioConsumer.on('score', onScore);

	channel.emit(audioConsumer.id, 'score', { producer: 10, consumer: 9 });
	channel.emit(audioConsumer.id, 'score', { producer: 9, consumer: 9 });
	channel.emit(audioConsumer.id, 'score', { producer: 8, consumer: 8 });

	expect(onScore).toHaveBeenCalledTimes(3);
	expect(audioConsumer.score).toEqual({ producer: 8, consumer: 8 });
}, 2000);

test('consumer.close() succeeds', async () =>
{
	const onObserverClose = jest.fn();

	audioConsumer.observer.once('close', onObserverClose);
	audioConsumer.close();

	expect(onObserverClose).toHaveBeenCalledTimes(1);
	expect(audioConsumer.closed).toBe(true);

	await expect(router.dump())
		.resolves
		.toMatchObject(
			{
				mapProducerIdConsumerIds : { [audioProducer.id]: [] },
				mapConsumerIdProducerId  : {}
			});

	await expect(transport2.dump())
		.resolves
		.toMatchObject(
			{
				id          : transport2.id,
				producerIds : [],
				consumerIds : [ videoConsumer.id ]
			});
}, 2000);

test('Consumer methods reject if closed', async () =>
{
	await expect(audioConsumer.dump())
		.rejects
		.toThrow(Error);

	await expect(audioConsumer.getStats())
		.rejects
		.toThrow(Error);

	await expect(audioConsumer.pause())
		.rejects
		.toThrow(Error);

	await expect(audioConsumer.resume())
		.rejects
		.toThrow(Error);

	await expect(audioConsumer.setPreferredLayers({}))
		.rejects
		.toThrow(Error);

	await expect(audioConsumer.requestKeyFrame())
		.rejects
		.toThrow(Error);
}, 2000);

test('Consumer emits "producerclose" if Producer is closed', async () =>
{
	audioConsumer = await transport2.consume(
		{
			producerId      : audioProducer.id,
			rtpCapabilities : consumerDeviceCapabilities
		});

	const onObserverClose = jest.fn();

	audioConsumer.observer.once('close', onObserverClose);

	await new Promise((resolve) =>
	{
		audioConsumer.on('producerclose', resolve);
		audioProducer.close();
	});

	expect(onObserverClose).toHaveBeenCalledTimes(1);
	expect(audioConsumer.closed).toBe(true);
}, 2000);

test('Consumer emits "transportclose" if Transport is closed', async () =>
{
	videoConsumer = await transport2.consume(
		{
			producerId      : videoProducer.id,
			rtpCapabilities : consumerDeviceCapabilities
		});

	const onObserverClose = jest.fn();

	videoConsumer.observer.once('close', onObserverClose);

	await new Promise((resolve) =>
	{
		videoConsumer.on('transportclose', resolve);
		transport2.close();
	});

	expect(onObserverClose).toHaveBeenCalledTimes(1);
	expect(videoConsumer.closed).toBe(true);

	await expect(router.dump())
		.resolves
		.toMatchObject(
			{
				mapProducerIdConsumerIds : {},
				mapConsumerIdProducerId  : {}
			});
}, 2000);

#ifndef MS_RTC_PAYLOAD_DESCRIPTOR_HANDLER_HPP
#define MS_RTC_PAYLOAD_DESCRIPTOR_HANDLER_HPP

#include "common.hpp"

namespace RTC
{
	namespace Codecs
	{
		// Codec payload descriptor.
		struct PayloadDescriptor
		{
			virtual ~PayloadDescriptor() = default;
			virtual void Dump() const    = 0;
		};

		// Encoding context used by PayloadDescriptorHandler to properly rewrite the
		// PayloadDescriptor.
		class EncodingContext
		{
		public:
			EncodingContext()          = default;
			virtual ~EncodingContext() = default;

		public:
			int16_t GetTargetSpatialLayer() const;
			int16_t GetTargetTemporalLayer() const;
			int16_t GetCurrentSpatialLayer() const;
			int16_t GetCurrentTemporalLayer() const;
			void SetTargetSpatialLayer(int16_t spatialLayer);
			void SetTargetTemporalLayer(int16_t temporalLayer);
			void SetCurrentSpatialLayer(int16_t spatialLayer);
			void SetCurrentTemporalLayer(int16_t temporalLayer);
			virtual void SyncRequired() = 0;

		private:
			int16_t targetSpatialLayer{ -1 };
			int16_t targetTemporalLayer{ -1 };
			int16_t currentSpatialLayer{ -1 };
			int16_t currentTemporalLayer{ -1 };
		};

		/* Inline instance methods. */

		inline int16_t EncodingContext::GetTargetSpatialLayer() const
		{
			return this->targetSpatialLayer;
		}

		inline int16_t EncodingContext::GetTargetTemporalLayer() const
		{
			return this->targetTemporalLayer;
		}

		inline int16_t EncodingContext::GetCurrentSpatialLayer() const
		{
			return this->currentSpatialLayer;
		}

		inline int16_t EncodingContext::GetCurrentTemporalLayer() const
		{
			return this->currentTemporalLayer;
		}

		inline void EncodingContext::SetTargetSpatialLayer(int16_t spatialLayer)
		{
			this->targetSpatialLayer = spatialLayer;
		}

		inline void EncodingContext::SetTargetTemporalLayer(int16_t temporalLayer)
		{
			this->targetTemporalLayer = temporalLayer;
		}

		inline void EncodingContext::SetCurrentSpatialLayer(int16_t spatialLayer)
		{
			this->currentSpatialLayer = spatialLayer;
		}

		inline void EncodingContext::SetCurrentTemporalLayer(int16_t temporalLayer)
		{
			this->currentTemporalLayer = temporalLayer;
		}

		class PayloadDescriptorHandler
		{
		public:
			virtual ~PayloadDescriptorHandler() = default;

		public:
			virtual void Dump() const                                                  = 0;
			virtual bool Process(RTC::Codecs::EncodingContext* context, uint8_t* data) = 0;
			virtual void Restore(uint8_t* data)                                        = 0;
			virtual uint8_t GetSpatialLayer() const                                    = 0;
			virtual uint8_t GetTemporalLayer() const                                   = 0;
			virtual bool IsKeyFrame() const                                            = 0;
		};
	} // namespace Codecs
} // namespace RTC

#endif

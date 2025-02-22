#define MS_CLASS "RTC::RTCP::FeedbackPsRembPacket"
// #define MS_LOG_DEV

#include "RTC/RTCP/FeedbackPsRemb.hpp"
#include "Logger.hpp"
#include "Utils.hpp"
#include <cstring>

namespace RTC
{
	namespace RTCP
	{
		/* Class variables. */

		uint32_t FeedbackPsRembPacket::uniqueIdentifier{ 0x52454D42 };

		/* Class methods. */

		FeedbackPsRembPacket* FeedbackPsRembPacket::Parse(const uint8_t* data, size_t len)
		{
			MS_TRACE();

			// Check that there is space for the REMB unique identifier and basic fields.
			// NOTE: Feedback.cpp already checked that there is space for CommonHeader and
			// Feedback Header.
			if (sizeof(CommonHeader) + sizeof(FeedbackPacket::Header) + 8 > len)
			{
				MS_WARN_TAG(rtcp, "not enough space for Feedback packet, discarded");

				return nullptr;
			}

			auto* commonHeader = const_cast<CommonHeader*>(reinterpret_cast<const CommonHeader*>(data));

			std::unique_ptr<FeedbackPsRembPacket> packet(new FeedbackPsRembPacket(commonHeader));

			if (!packet->IsCorrect())
				return nullptr;

			return packet.release();
		}

		FeedbackPsRembPacket::FeedbackPsRembPacket(CommonHeader* commonHeader)
		  : FeedbackPsAfbPacket(commonHeader, FeedbackPsAfbPacket::Application::REMB)
		{
			size_t len = static_cast<size_t>(ntohs(commonHeader->length) + 1) * 4;
			// Make data point to the 4 bytes that must containt the "REMB" identifier.
			auto* data = reinterpret_cast<uint8_t*>(commonHeader) + sizeof(CommonHeader) +
			             sizeof(FeedbackPacket::Header);
			size_t numSsrcs = data[4];

			// Ensure there is space for the the announced number of SSRC feedbacks.
			if (len != sizeof(CommonHeader) + sizeof(FeedbackPacket::Header) + 8 + (numSsrcs * sizeof(uint32_t)))
			{
				MS_WARN_TAG(
				  rtcp, "invalid payload size (%zu bytes) for the given number of ssrcs (%zu)", len, numSsrcs);

				this->isCorrect = false;

				return;
			}

			// Verify the "REMB" unique identifier.
			if (Utils::Byte::Get4Bytes(data, 0) != FeedbackPsRembPacket::uniqueIdentifier)
			{
				MS_WARN_TAG(rtcp, "invalid unique indentifier in REMB packet");

				this->isCorrect = false;

				return;
			}

			// size_t numSsrcs  = data[12];
			uint8_t exponent = data[5] >> 2;
			uint64_t mantissa =
			  (static_cast<uint32_t>(data[5] & 0x03) << 16) | Utils::Byte::Get2Bytes(data, 6);

			this->bitrate = (mantissa << exponent);

			if ((this->bitrate >> exponent) != mantissa)
			{
				MS_WARN_TAG(rtcp, "invalid REMB bitrate value: %" PRIu64 " *2^%u", mantissa, exponent);

				this->isCorrect = false;

				return;
			}

			// Make index point to the first SSRC feedback item.
			size_t index{ 8 };

			this->ssrcs.reserve(numSsrcs);

			for (size_t n{ 0 }; n < numSsrcs; ++n)
			{
				this->ssrcs.push_back(Utils::Byte::Get4Bytes(data, index));
				index += sizeof(uint32_t);
			}
		}

		size_t FeedbackPsRembPacket::Serialize(uint8_t* buffer)
		{
			MS_TRACE();

			size_t offset     = FeedbackPsPacket::Serialize(buffer);
			uint64_t mantissa = this->bitrate;
			uint8_t exponent{ 0 };

			while (mantissa > 0x3FFFF /* max mantissa (18 bits) */)
			{
				mantissa >>= 1;
				++exponent;
			}

			Utils::Byte::Set4Bytes(buffer, offset, FeedbackPsRembPacket::uniqueIdentifier);
			offset += sizeof(FeedbackPsRembPacket::uniqueIdentifier);

			buffer[offset] = this->ssrcs.size();
			offset += 1;

			buffer[offset] = (exponent << 2) | (mantissa >> 16);
			offset += 1;

			Utils::Byte::Set2Bytes(buffer, offset, mantissa & 0xFFFF);
			offset += 2;

			for (auto ssrc : this->ssrcs)
			{
				Utils::Byte::Set4Bytes(buffer, offset, ssrc);
				offset += sizeof(ssrc);
			}

			return offset;
		}

		void FeedbackPsRembPacket::Dump() const
		{
			MS_TRACE();

			MS_DEBUG_DEV("<FeedbackPsRembPacket>");
			FeedbackPsPacket::Dump();
			MS_DEBUG_DEV("  bitrate (bps): %" PRIu64, this->bitrate);
#ifdef MS_LOG_DEV
			for (auto ssrc : this->ssrcs)
			{
				MS_DEBUG_DEV("  ssrc: %" PRIu32, ssrc);
			}
#endif
			MS_DEBUG_DEV("</FeedbackPsRembPacket>");
		}
	} // namespace RTCP
} // namespace RTC

#ifndef MS_RTC_PLAIN_RTP_TRANSPORT_HPP
#define MS_RTC_PLAIN_RTP_TRANSPORT_HPP

#include "RTC/Transport.hpp"
#include "RTC/TransportTuple.hpp"
#include "RTC/UdpSocket.hpp"

namespace RTC
{
	class PlainRtpTransport : public RTC::Transport, public RTC::UdpSocket::Listener
	{
	private:
		struct ListenIp
		{
			std::string ip;
			std::string announcedIp;
		};

	public:
		PlainRtpTransport(const std::string& id, RTC::Transport::Listener* listener, json& data);
		~PlainRtpTransport() override;

	public:
		void FillJson(json& jsonObject) const override;
		void FillJsonStats(json& jsonArray) override;
		void HandleRequest(Channel::Request* request) override;

	private:
		bool IsConnected() const override;
		void SendRtpPacket(
		  RTC::RtpPacket* packet,
		  RTC::Consumer* consumer,
		  bool retransmitted = false,
		  bool probation     = false) override;
		void SendRtcpPacket(RTC::RTCP::Packet* packet) override;
		void SendRtcpCompoundPacket(RTC::RTCP::CompoundPacket* packet) override;
		void OnPacketRecv(RTC::TransportTuple* tuple, const uint8_t* data, size_t len);
		void OnRtpDataRecv(RTC::TransportTuple* tuple, const uint8_t* data, size_t len);
		void OnRtcpDataRecv(RTC::TransportTuple* tuple, const uint8_t* data, size_t len);

		/* Pure virtual methods inherited from RTC::Transport. */
	private:
		void UserOnNewProducer(RTC::Producer* producer) override;
		void UserOnNewConsumer(RTC::Consumer* consumer) override;
		void UserOnRembFeedback(RTC::RTCP::FeedbackPsRembPacket* remb) override;

		/* Pure virtual methods inherited from RTC::Consumer::Listener. */
	public:
		void OnConsumerNeedBitrateChange(RTC::Consumer* consumer) override;

		/* Pure virtual methods inherited from RTC::UdpSocket::Listener. */
	public:
		void OnPacketRecv(
		  RTC::UdpSocket* socket, const uint8_t* data, size_t len, const struct sockaddr* remoteAddr) override;

	private:
		// Allocated by this.
		RTC::UdpSocket* udpSocket{ nullptr };
		RTC::UdpSocket* rtcpUdpSocket{ nullptr };
		RTC::TransportTuple* tuple{ nullptr };
		RTC::TransportTuple* rtcpTuple{ nullptr };
		// Others.
		ListenIp listenIp;
		bool rtcpMux{ true };
		bool comedia{ false };
		bool multiSource{ false };
		struct sockaddr_storage remoteAddrStorage;
		struct sockaddr_storage rtcpRemoteAddrStorage;
	};
} // namespace RTC

#endif
